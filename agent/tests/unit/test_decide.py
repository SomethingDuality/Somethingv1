"""The memory decision table (memory/decide.py): every rule, plus R12 confirms."""
from app.memory.decide import combine, decide


def cand(**kw):
    base = {"candidate_id": "c1", "text": "New fact.", "provenance": "founder_asserted", "user_direct": False,
            "modality": "decided", "kind_hint": "fact", "observed_at": "2026-10-01T00:00:00+00:00"}
    return {**base, **kw}


def note(id_="n1", **kw):
    return {"note_id": id_, "text": "Old fact.", "provenance": "founder_asserted", "valid_at": "2026-09-01T00:00:00+00:00",
            "created_at": "2026-09-01T00:00:00+00:00", "cosine": 0.9, "same_slot": False, **kw}


def j(rel, id_="n1", modality="decided", **kw):
    return [{"note_id": id_, "order": o, "relation": rel, "modality": modality, "valid_at": None, **kw} for o in ("ab", "ba")]


def test_no_neighbours_is_add():
    assert decide(cand(), [], [])["op"] == "ADD"


def test_same_is_noop_and_counts_as_restated():
    d = decide(cand(), [note()], j("same"))
    assert (d["op"], d["target_note_ids"], d["rule"]) == ("NOOP", ["n1"], "same")


def test_refines_same_slot_is_update_free_text_is_add_with_link():
    d = decide(cand(slot_key="idea.target_customer", value="canteens"), [note(same_slot=True, slot_key="idea.target_customer", value="colleges")], j("refines"))
    assert d["op"] == "UPDATE"
    d = decide(cand(), [note()], j("refines"))
    assert d["op"] == "ADD" and d["links"] == [{"rel": "refines", "note_id": "n1"}]


def test_decided_change_invalidates_old():
    d = decide(cand(), [note()], j("changes"))
    assert (d["op"], d["target_note_ids"]) == ("INVALIDATE", ["n1"])


def test_considering_never_supersedes():
    assert decide(cand(), [note()], j("changes", modality="considering"))["op"] == "ADD_OPTION"
    assert decide(cand(modality="considering"), [], [])["op"] == "ADD_OPTION"
    assert decide(cand(), [note()], j("hypothetical"))["op"] == "ADD_OPTION"


def test_rejected_is_kept_as_a_decision():
    d = decide(cand(), [note()], j("changes", modality="rejected"))
    assert d["op"] == "ADD" and d["links"][0]["rel"] == "rejects"


def test_older_news_is_historical():
    d = decide(cand(valid_at="2026-01-01T00:00:00+00:00"), [note()], j("changes"))
    assert d["op"] == "ADD_HISTORICAL"


def test_lower_tier_cannot_invalidate_a_verified_fact():
    d = decide(cand(provenance="agent_inferred"), [note(provenance="verified_artefact")], j("contradicts"))
    assert d["op"] == "ADD_CONFLICT" and "conflict" in d["flags"]
    d = decide(cand(provenance="founder_asserted"), [note(provenance="verified_artefact")], j("contradicts"))
    assert d["op"] == "ADD_CONFLICT"


def test_judges_disagreeing_keeps_both_flagged():
    js = [{"note_id": "n1", "order": "ab", "relation": "same", "modality": "decided"},
          {"note_id": "n1", "order": "ba", "relation": "changes", "modality": "decided"}]
    assert combine(js[0], js[1])["relation"] == "unsure"
    d = decide(cand(), [note()], js)
    assert d["op"] == "ADD_CONFLICT" and d["flags"] == ["judge_unsure"]


def test_slot_holds_one_value_whatever_the_judge_says():
    n = note(same_slot=True, slot_key="idea.pricing", value="₹10 per kilo")
    d = decide(cand(slot_key="idea.pricing", value="₹12 per kilo", user_direct=True), [n], j("unrelated"))
    assert (d["op"], d["target_note_ids"]) == ("INVALIDATE", ["n1"])
    same = decide(cand(slot_key="idea.pricing", value="₹10 PER KILO"), [n], [])
    assert (same["op"], same["rule"]) == ("NOOP", "same_slot_value")


def test_r12_high_stakes_needs_confirm_unless_founder_typed_it():
    n = note(same_slot=True, slot_key="idea.stage", value="prototype")
    assert decide(cand(slot_key="idea.stage", value="mvp"), [n], j("changes"))["needs_confirm"] is True
    assert decide(cand(slot_key="idea.stage", value="mvp", user_direct=True), [n], j("changes"))["needs_confirm"] is False
    assert decide(cand(slot_key="idea.target_customer", value="x"), [], [])["needs_confirm"] is False  # not high stakes
    assert decide(cand(slot_key="idea.stage", value="mvp"), [], [])["needs_confirm"] is True  # first value, inferred
