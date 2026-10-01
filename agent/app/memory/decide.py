"""E_DECIDE as a pure table. The judge only classifies how NEW relates to EXISTING; this code picks
the operation (research: an LLM asked "which is true" corrects contrarian founders toward the
typical pattern, and brainstorming read as INVALIDATE silently overwrites true facts).

Rules, highest priority first, over the judged neighbours:
  same                       -> NOOP (counts as the founder restating it: +1 cite)
  refines, same slot         -> UPDATE (new version in the lineage; the old one is superseded)
  changes/contradicts:
      considering/hypothetical -> ADD_OPTION (an option never supersedes anything)
      rejected                 -> ADD (a rejected option is a decision worth keeping)
      NEW is older than EXISTING (valid_at) -> ADD_HISTORICAL
      EXISTING has a higher provenance tier -> ADD_CONFLICT (both kept, linked, flagged)
      otherwise                -> INVALIDATE EXISTING + ADD NEW
  judges disagree (AB vs BA) -> ADD_CONFLICT flagged 'judge_unsure' (never silently drop new info)
  refines, no slot           -> ADD + 'refines' link
  hypothetical               -> ADD_OPTION
  unrelated / no neighbours  -> ADD (or ADD_OPTION when the candidate itself is an option)

R12: a high-stakes slot that would change (ADD/UPDATE/INVALIDATE) needs the founder's confirm
unless the founder typed it themselves (user_direct)."""
from app.memory import slots
from app.memory.schemas import TIER

WRITES_SLOT = {"ADD", "UPDATE", "INVALIDATE"}


def _when(note_or_cand: dict) -> str:
    return note_or_cand.get("valid_at") or note_or_cand.get("observed_at") or note_or_cand.get("created_at") or ""


def _equal(a, b) -> bool:
    if a is None or b is None:
        return False
    if isinstance(a, list) or isinstance(b, list):
        return sorted(map(str, a if isinstance(a, list) else [a])) == sorted(map(str, b if isinstance(b, list) else [b]))
    return str(a).strip().lower() == str(b).strip().lower()


def combine(ab: dict | None, ba: dict | None) -> dict | None:
    """One relation per neighbour from the two orders. Disagreement means 'unsure'."""
    if not ab and not ba:
        return None
    if not ab or not ba:
        return ab or ba
    if ab["relation"] != ba["relation"]:
        return {**ab, "relation": "unsure"}
    return ab


def decide(candidate: dict, neighbours: list[dict], judgements: list[dict]) -> dict:
    slot = slots.get(candidate.get("slot_key"))
    by_note: dict[str, dict] = {}
    for j in judgements:
        by_note.setdefault(j["note_id"], {})[j["order"]] = j
    judged = []
    for n in neighbours:
        pair = by_note.get(n["note_id"], {})
        j = combine(pair.get("ab"), pair.get("ba"))
        if j:
            judged.append((n, j))

    is_option = candidate.get("modality") in ("considering",) or candidate.get("kind_hint") == "option"
    op, targets, links, flags, rule = "ADD", [], [], [], "no_neighbours"

    def pick(rel: str, same_slot: bool | None = None):
        for n, j in judged:
            if j["relation"] == rel and (same_slot is None or bool(n.get("same_slot")) == same_slot):
                return n, j
        return None

    same_slot = [n for n in neighbours if n.get("same_slot")]
    if slot and any(_equal(n.get("value"), candidate.get("value")) for n in same_slot):
        n = next(n for n in same_slot if _equal(n.get("value"), candidate.get("value")))
        return {"op": "NOOP", "target_note_ids": [n["note_id"]], "links": [], "flags": [], "rule": "same_slot_value", "needs_confirm": False}

    if hit := pick("same"):
        op, targets, rule = "NOOP", [hit[0]["note_id"]], "same"
    elif hit := pick("refines", same_slot=True):
        op, targets, rule = "UPDATE", [hit[0]["note_id"]], "refines_slot"
    elif hit := (pick("changes") or pick("contradicts")):
        n, j = hit
        modality = j.get("modality") or candidate.get("modality") or "decided"
        if modality == "considering" or is_option:
            op, rule = "ADD_OPTION", "change_considered"
            links = [{"rel": "option_for", "note_id": n["note_id"]}]
        elif modality == "rejected":
            op, rule = "ADD", "change_rejected"
            links = [{"rel": "rejects", "note_id": n["note_id"]}]
        else:
            new_when = j.get("valid_at") or candidate.get("valid_at") or candidate.get("observed_at") or ""
            if new_when and _when(n) and new_when < _when(n):
                op, rule = "ADD_HISTORICAL", "older_than_existing"
                links = [{"rel": "superseded_by", "note_id": n["note_id"]}]
            elif TIER.get(n.get("provenance"), 0) > TIER.get(candidate.get("provenance"), 0):
                op, rule = "ADD_CONFLICT", "lower_tier_contradiction"
                links, flags = [{"rel": "contradicts", "note_id": n["note_id"]}], ["conflict"]
            else:
                op, targets, rule = "INVALIDATE", [n["note_id"]], "decided_change"
                links = [{"rel": "contradicts", "note_id": n["note_id"]}]
    elif hit := pick("unsure"):
        op, rule = "ADD_CONFLICT", "judge_unsure"
        links, flags = [{"rel": "unsure", "note_id": hit[0]["note_id"]}], ["judge_unsure"]
    elif hit := pick("refines", same_slot=False):
        op, rule = "ADD", "refines_free"
        links = [{"rel": "refines", "note_id": hit[0]["note_id"]}]
    elif pick("hypothetical"):
        op, rule = "ADD_OPTION", "hypothetical"
    elif judged:
        rule = "unrelated"

    if op == "ADD" and is_option:
        op = "ADD_OPTION"
    # A slot holds one current value: a decided ADD next to a different current value replaces it,
    # whatever the judge called the pair (unless that value outranks the candidate).
    if op == "ADD" and slot and same_slot and rule != "change_rejected":
        n = same_slot[0]
        if TIER.get(n.get("provenance"), 0) > TIER.get(candidate.get("provenance"), 0):
            op, rule, flags = "ADD_CONFLICT", "slot_lower_tier", ["conflict"]
            links = [{"rel": "contradicts", "note_id": n["note_id"]}]
        else:
            op, targets, rule = "INVALIDATE", [n["note_id"]], "slot_single_value"
            links = [{"rel": "contradicts", "note_id": n["note_id"]}]
    needs_confirm = bool(slot and slot.high_stakes and op in WRITES_SLOT and not candidate.get("user_direct"))
    return {"op": op, "target_note_ids": targets, "links": links, "flags": flags, "rule": rule, "needs_confirm": needs_confirm}
