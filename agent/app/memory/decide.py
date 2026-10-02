"""E_DECIDE as a pure table. The judge only classifies how NEW relates to EXISTING; this code picks
the operation (research: an LLM asked "which is true" corrects contrarian founders toward the
typical pattern, and brainstorming read as INVALIDATE silently overwrites true facts).

Rules, highest priority first, over the judged neighbours (for a slot candidate, the same-slot
neighbours are decided first: a free-form note that reads "the same" never hides a slot change):
  same                       -> NOOP (counts as the founder restating it: +1 cite)
  the candidate is an option -> ADD_OPTION (whatever it refines or changes: options never replace)
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

Never: an UPDATE/INVALIDATE of a note in another scope (an idea chat can't rewrite the founder's
profile) or of a slot note by a candidate without that slot (it would leave the slot empty).
Those become ADD_CONFLICT instead.

R12: a high-stakes slot that would change (ADD/UPDATE/INVALIDATE), the candidate's or a target's,
needs the founder's confirm unless the founder typed it themselves (user_direct)."""
from datetime import datetime, timezone

from app.memory import slots
from app.memory.schemas import TIER

WRITES_SLOT = {"ADD", "UPDATE", "INVALIDATE"}


def parse_when(value) -> datetime | None:
    """An ISO date or datetime, or None. Models write dates freely ("March 2026"); compared as
    strings, one such value would make every later change look older than it (and never apply)."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def when_iso(value) -> str | None:
    d = parse_when(value)
    return d.isoformat() if d else None


def _when(note_or_cand: dict) -> datetime | None:
    return parse_when(note_or_cand.get("valid_at")) or parse_when(note_or_cand.get("observed_at")) or parse_when(note_or_cand.get("created_at"))


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


def _decide_pool(candidate: dict, pool: list[tuple[dict, dict]], is_option: bool):
    """The rules over one group of judged neighbours. None when nothing in it decides."""
    def pick(rel: str, same_slot: bool | None = None):
        for n, j in pool:
            if j["relation"] == rel and (same_slot is None or bool(n.get("same_slot")) == same_slot):
                return n, j
        return None

    if hit := pick("same"):
        return "NOOP", [hit[0]["note_id"]], [], [], "same"
    if is_option and (hit := pick("refines") or pick("changes") or pick("contradicts")):
        return "ADD_OPTION", [], [{"rel": "option_for", "note_id": hit[0]["note_id"]}], [], "option_considered"
    if hit := pick("refines", same_slot=True):
        return "UPDATE", [hit[0]["note_id"]], [], [], "refines_slot"
    if hit := (pick("changes") or pick("contradicts")):
        n, j = hit
        modality = j.get("modality") or candidate.get("modality") or "decided"
        if modality == "considering":
            return "ADD_OPTION", [], [{"rel": "option_for", "note_id": n["note_id"]}], [], "change_considered"
        if modality == "rejected":
            return "ADD", [], [{"rel": "rejects", "note_id": n["note_id"]}], [], "change_rejected"
        new_when = parse_when(j.get("valid_at")) or parse_when(candidate.get("valid_at")) or parse_when(candidate.get("observed_at"))
        old_when = _when(n)
        if new_when and old_when and new_when < old_when:
            return "ADD_HISTORICAL", [], [{"rel": "superseded_by", "note_id": n["note_id"]}], [], "older_than_existing"
        if TIER.get(n.get("provenance"), 0) > TIER.get(candidate.get("provenance"), 0):
            return "ADD_CONFLICT", [], [{"rel": "contradicts", "note_id": n["note_id"]}], ["conflict"], "lower_tier_contradiction"
        return "INVALIDATE", [n["note_id"]], [{"rel": "contradicts", "note_id": n["note_id"]}], [], "decided_change"
    if hit := pick("unsure"):
        return "ADD_CONFLICT", [], [{"rel": "unsure", "note_id": hit[0]["note_id"]}], ["judge_unsure"], "judge_unsure"
    if hit := pick("refines", same_slot=False):
        return "ADD", [], [{"rel": "refines", "note_id": hit[0]["note_id"]}], [], "refines_free"
    if pick("hypothetical"):
        return "ADD_OPTION", [], [], [], "hypothetical"
    return None


def decide(candidate: dict, neighbours: list[dict], judgements: list[dict], scope_key: str | None = None) -> dict:
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

    same_slot = [n for n in neighbours if n.get("same_slot")]
    if slot and any(_equal(n.get("value"), candidate.get("value")) for n in same_slot):
        n = next(n for n in same_slot if _equal(n.get("value"), candidate.get("value")))
        return {"op": "NOOP", "target_note_ids": [n["note_id"]], "links": [], "flags": [], "rule": "same_slot_value", "needs_confirm": False}

    pools = ([(n, j) for n, j in judged if n.get("same_slot")], [(n, j) for n, j in judged if not n.get("same_slot")]) if slot else (judged,)
    for pool in pools:
        if decided := _decide_pool(candidate, pool, is_option):
            op, targets, links, flags, rule = decided
            break
    else:
        if judged:
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
    # Never rewrite a note in another scope, or empty a slot with a candidate that doesn't fill it.
    target_notes = [n for n in neighbours if n["note_id"] in targets]
    if op in ("UPDATE", "INVALIDATE") and target_notes:
        t = target_notes[0]
        other_scope = bool(scope_key and t.get("scope_key") and t["scope_key"] != scope_key)
        empties_slot = bool(t.get("slot_key")) and t.get("slot_key") != (slot.key if slot else None)
        if other_scope or empties_slot:
            op, targets, flags = "ADD_CONFLICT", [], ["conflict"]
            rule = "other_scope" if other_scope else "slotless_change"
            links = [{"rel": "contradicts", "note_id": t["note_id"]}]
            target_notes = []
    high = bool(slot and slot.high_stakes) or any((s := slots.get(n.get("slot_key"))) and s.high_stakes for n in target_notes)
    needs_confirm = bool(high and op in WRITES_SLOT and not candidate.get("user_direct"))
    return {"op": op, "target_note_ids": targets, "links": links, "flags": flags, "rule": rule, "needs_confirm": needs_confirm}
