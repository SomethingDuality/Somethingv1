"""The memory engine end to end on fake models: write graph, R12 confirms, concurrency, replays,
ingestion from Node events, and the read path."""
import asyncio

import pytest

from app.core import checkpointer, db, jobs
from app.core.runs import manager
from app.memory import confirms, ingest, read, store
from app.memory.graph.builder import compile_memory_write

USER, IDEA = "65f000000000000000000001", "65f0000000000000000000aa"


@pytest.fixture(autouse=True)
def memory_graph(fake_node):
    import app.memory.fakes  # noqa: F401
    manager.register("memory_write", compile_memory_write(checkpointer.saver()), durability="exit")
    fake_node.add_user(USER, "Founder", location="Pune")
    fake_node.add_idea(IDEA, USER, title="Campus compost", description="Composting for canteens.", stage="prototype")
    yield fake_node


def scope():
    return ingest.idea_scope(USER, IDEA)


def cand(cid, text, **kw):
    base = {"candidate_id": cid, "text": text, "quote": text, "kind_hint": "fact", "modality": "decided",
            "provenance": "founder_asserted", "source": {"type": "chat"}, "user_direct": False,
            "observed_at": "2026-10-01T10:00:00+00:00"}
    return {**base, **kw}


async def current(slot_key=None):
    notes = await store.current_notes([scope()["scope_key"]], embeddings=False)
    return [n for n in notes if slot_key is None or n.get("slot_key") == slot_key]


async def test_add_then_exact_restatement_is_a_cite():
    await ingest.run_candidate(scope(), cand("a1", "Canteens pay per kilo of food waste collected."))
    await ingest.run_candidate(scope(), cand("a2", "Canteens pay per kilo of food waste collected."))
    notes = await current()
    assert len(notes) == 1 and notes[0]["cite_count"] == 1
    assert notes[0]["embedding_model"] == "fake-hash-v1"


async def test_founder_typed_slot_changes_replace_without_confirm():
    s = scope()
    await ingest.run_candidate(s, ingest.field_candidate(s, ingest.slots.get("idea.pricing"), "₹10 per kilo", "2026-09-01", "pricing"))
    await ingest.run_candidate(s, ingest.field_candidate(s, ingest.slots.get("idea.pricing"), "₹12 per kilo", "2026-10-01", "pricing"))
    notes = await current("idea.pricing")
    assert [n["value"] for n in notes] == ["₹12 per kilo"]
    old = await db.col("agent_notes").find_one({"value": "₹10 per kilo"})
    assert old["status"] == "invalidated" and old["invalid_at"] == "2026-10-01T00:00:00+00:00"  # stored as ISO


async def _wait_for_confirm():
    for _ in range(100):
        doc = await db.col("agent_pending_confirms").find_one({"status": "open"})
        if doc:
            run = await db.col("agent_runs").find_one({"_id": doc["run_id"]})
            if run["status"] == "interrupted":
                return doc
        await asyncio.sleep(0.02)
    raise AssertionError("no confirm")


async def _seed_stage():
    s = scope()
    await ingest.run_candidate(s, ingest.field_candidate(s, ingest.slots.get("idea.stage"), "prototype", "2026-09-01", "stage"))


async def test_r12_inferred_stage_change_waits_for_the_founder(memory_graph):
    await _seed_stage()
    run = await ingest.run_candidate(scope(), cand("s1", "The founder says the MVP is live now.", slot_key="idea.stage", value="mvp"))
    assert run["status"] == "interrupted"
    c = await _wait_for_confirm()
    assert c["prompt"] == "The stage for “Campus compost”: Prototype → MVP, right?"
    assert memory_graph.questions[c["_id"]]["proposed"] == "MVP"
    assert [n["value"] for n in await current("idea.stage")] == ["prototype"], "nothing changes before the founder says yes"

    await confirms.resolve(c["_id"], USER, "yes")
    await manager.wait(c["run_id"])
    notes = await current("idea.stage")
    assert [(n["value"], n["provenance"], bool(n.get("confirmed_at"))) for n in notes] == [("mvp", "founder_asserted", True)]
    assert memory_graph.updates[-1] == {"userId": USER, "entity": "idea", "patch": {"stage": "mvp"}, "entityId": IDEA, "ref": "s1"}


async def test_r12_skip_or_change(memory_graph):
    await _seed_stage()
    await ingest.run_candidate(scope(), cand("s2", "Launched last week.", slot_key="idea.stage", value="launched"))
    c = await _wait_for_confirm()
    await confirms.resolve(c["_id"], USER, "skip")
    await manager.wait(c["run_id"])
    assert [n["value"] for n in await current("idea.stage")] == ["prototype"]
    decision = await db.col("agent_memory_decisions").find_one({"decision.rule": "unconfirmed_skip"})
    assert decision is not None

    await ingest.run_candidate(scope(), cand("s3", "We're an MVP.", slot_key="idea.stage", value="mvp"))
    c = await _wait_for_confirm()
    await confirms.resolve(c["_id"], USER, "change", "Launched")
    await manager.wait(c["run_id"])
    assert [n["value"] for n in await current("idea.stage")] == ["launched"]


async def test_expired_confirm_changes_nothing(memory_graph):
    from datetime import datetime, timedelta, timezone
    await _seed_stage()
    await ingest.run_candidate(scope(), cand("s4", "We are an MVP.", slot_key="idea.stage", value="mvp"))
    c = await _wait_for_confirm()
    await db.col("agent_pending_confirms").update_one({"_id": c["_id"]}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert await confirms.expire_confirms() == 1
    await manager.wait(c["run_id"])
    assert [n["value"] for n in await current("idea.stage")] == ["prototype"]
    assert c["_id"] not in memory_graph.questions


async def test_options_never_supersede_facts():
    await ingest.run_candidate(scope(), cand("o1", "The company is incorporated as a Pvt Ltd in India."))
    await ingest.run_candidate(scope(), cand("o2", "Maybe we incorporate in the UK instead.", modality="considering"))
    notes = await current()
    assert sorted(n["kind"] for n in notes) == ["fact", "option"]


async def test_replay_of_a_candidate_writes_once():
    c = cand("r1", "Twelve canteens signed a pilot.")
    await ingest.run_candidate(scope(), c)
    await db.col("agent_runs").update_many({}, {"$set": {"status": "failed"}})  # force the job path to run it again
    await ingest.run_candidate(scope(), c)
    assert len(await current()) == 1


async def test_parallel_writers_keep_one_value_per_slot():
    """Jobs serialise writes per scope, but a confirm resuming can race a job. The version guard
    must keep one current value per slot; a writer that keeps losing fails and is retried later."""
    s = scope()
    slot = ingest.slots.get("idea.pricing")
    results = await asyncio.gather(*[
        ingest.run_candidate(s, ingest.field_candidate(s, slot, f"₹{p} per kilo", f"2026-10-0{p % 9 + 1}", "pricing"))
        for p in (10, 11, 12, 13)
    ], return_exceptions=True)
    assert all(isinstance(r, dict) or isinstance(r, ingest.MemoryWriteFailed) for r in results)
    assert any(isinstance(r, dict) for r in results)
    assert len(await current("idea.pricing")) == 1


async def test_lower_tier_contradiction_is_kept_as_a_conflict():
    from datetime import datetime, timezone
    await store.ensure_scope(scope())
    await db.col("agent_notes").insert_one({
        "_id": "v1", "scope_key": scope()["scope_key"], "scope_kind": "idea", "user_id": USER, "idea_id": IDEA,
        "lineage_id": "L1", "version": 1, "slot_key": "idea.pricing", "kind": "fact", "text": "Pricing: ₹10 per kilo.",
        "value": "₹10 per kilo", "provenance": "verified_artefact", "status": "current", "created_at": datetime.now(timezone.utc),
        "valid_at": "2026-09-01", "source": {"type": "verifier"}, "cite_count": 0, "embedding": None, "decay_class": "none",
    })
    await ingest.run_candidate(scope(), cand("p1", "Pricing: ₹99 per kilo.", slot_key="idea.pricing", value="₹99 per kilo", user_direct=True))
    values = sorted(n["value"] for n in await current("idea.pricing"))
    assert values == ["₹10 per kilo", "₹99 per kilo"]
    assert (await read.known([scope()["scope_key"]], "idea.pricing"))["value"] == "₹10 per kilo", "verified wins the read"


async def test_events_reconcile_fields_and_extract_the_description(memory_graph, app_client):
    from tests.conftest import SERVICE
    memory_graph.ideas[IDEA]["fieldSources"] = {"stage": {"source": "profile", "at": "2026-09-01T00:00:00Z"}}
    memory_graph.ideas[IDEA]["fields"]["description"] = "We charge canteens ₹10 per kilo collected. Twelve canteens in Pune signed up."
    res = await app_client.post("/internal/events", json={"eventType": "idea.updated", "eventId": "ev-1", "ideaId": IDEA, "founderId": USER}, headers=SERVICE)
    assert res.json()["status"] == "queued"
    await jobs.worker.drain()
    notes = await current()
    by_slot = {n.get("slot_key"): n for n in notes}
    assert by_slot["idea.stage"]["value"] == "prototype" and by_slot["idea.stage"]["source"]["type"] == "profile_field"
    assert any("Twelve canteens" in n["quote"] for n in notes)
    # The extracted price is high stakes and inferred, so it waits for a confirm.
    assert await db.col("agent_pending_confirms").count_documents({"slot_key": "idea.pricing"}) == 1

    again = await app_client.post("/internal/events", json={"eventType": "idea.updated", "eventId": "ev-2", "ideaId": IDEA, "founderId": USER}, headers=SERVICE)
    assert again.json()["status"] == "queued"
    await jobs.worker.drain()
    assert len(await current()) == len(notes), "unchanged text is not extracted twice"


async def test_recall_ranks_the_relevant_note_first():
    for i, t in enumerate(["Canteens pay per kilo of waste.", "The team has two engineers.", "Pilots run in Pune colleges."]):
        await ingest.run_candidate(scope(), cand(f"q{i}", t))
    top = await read.recall([scope()["scope_key"]], "how do canteens pay", k=2)
    assert top[0]["text"] == "Canteens pay per kilo of waste."
    assert "embedding" not in top[0]


async def test_a_write_that_died_before_its_first_checkpoint_starts_over():
    """Memory writes checkpoint only when they end or pause: a run left 'running' by a dead
    process has no checkpoint, so recovery restarts it from the input kept on the run."""
    from datetime import datetime, timedelta, timezone

    from app.core.checkpointer import thread_id
    old = datetime.now(timezone.utc) - timedelta(minutes=5)
    cand = ingest.field_candidate(scope(), ingest.slots.get("idea.pricing"), "₹10 per kilo", "2026-09-01", "pricing")
    run_id = "deadbeefdeadbeefdeadbeefdeadbeef"
    await db.col("agent_runs").insert_one({
        "_id": run_id, "thread_id": thread_id(USER, "mem", run_id, IDEA), "kind": "memory_write", "user_id": USER,
        "idea_id": IDEA, "status": "running", "owner": "dead-process", "heartbeat_at": old, "started_at": old,
        "candidate_id": cand["candidate_id"],
        "input": {"scope": scope(), "candidate": cand, "limits": ingest.limits(), "commit_attempts": 0},
    })
    assert await manager.recover() == 1
    await manager.wait(run_id)
    assert (await db.col("agent_runs").find_one({"_id": run_id}))["status"] == "complete"
    assert [n["value"] for n in await current("idea.pricing")] == ["₹10 per kilo"]
