"""Matched deal flow end to end: batches, exclusions, the 7-day window, the scheduler, reach."""
from datetime import datetime, timedelta, timezone

import pytest

from app.brain import deal_flow
from app.core import db, jobs

NOW = datetime.now(timezone.utc).isoformat()
INV, FOUNDER, OTHER = "65f0000000000000000000b1", "65f0000000000000000000f1", "65f0000000000000000000f2"


def idea(i, **kw):
    return {"id": f"65f00000000000000000{i:04d}", "founderId": OTHER, "title": f"Idea {i}", "description": "Composting for canteens in Pune.",
            "tags": ["climate"], "stage": "mvp", "raising": "25k_100k", "lookingFor": ["backend"], "founderLocation": "Pune",
            "createdAt": NOW, "likes": 0, **kw}


@pytest.fixture
def pool(fake_node):
    fake_node.public_ideas = [idea(i) for i in range(1, 9)] + [idea(99, tags=["fintech"]), idea(98, raising="not_raising")]
    fake_node.match_people[INV] = {"id": INV, "role": "Investor", "interests": ["climate"], "stageFocus": ["seed"], "minCheck": 5000,
                                   "maxCheck": 50000, "keywords": ["compost"], "thesis": "", "saved": [idea(1)["id"]], "committed": [idea(2)["id"]], "known": []}
    fake_node.match_people[FOUNDER] = {"id": FOUNDER, "role": "Founder", "skills": ["engineering"], "interests": ["climate"],
                                       "location": "Pune", "ownIdeas": [idea(3)["id"]], "known": []}
    return fake_node


async def test_investor_batch_excludes_saved_committed_and_non_matching(pool):
    view = await deal_flow.current(INV, "Investor")
    ids = [m["ideaId"] for m in view["matches"]]
    assert len(ids) == 5
    assert not {idea(1)["id"], idea(2)["id"], idea(99)["id"], idea(98)["id"]} & set(ids)
    assert view["matches"][0]["reasons"] and "score" not in view["matches"][0], "reasons, never scores"
    assert view["need"] is None and view["batch"]["nextAt"]


async def test_same_window_returns_the_same_batch_and_never_reshows(pool):
    first = await deal_flow.current(INV, "Investor")
    again = await deal_flow.current(INV, "Investor")
    assert first["batch"]["id"] == again["batch"]["id"]
    await db.col("agent_match_batches").update_many({}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(days=8)}})
    second = await deal_flow.build_batch(INV)
    shown_twice = set(m["ideaId"] for m in first["matches"]) & {m["idea_id"] async for m in db.col("agent_matches").find({"batch_id": second["_id"]})}
    assert not shown_twice
    assert second["size"] == 1, "8 ideas, 2 excluded, 5 already shown"


async def test_founder_gets_ideas_looking_for_their_skills_not_their_own(pool):
    view = await deal_flow.current(FOUNDER, "Founder")
    ids = [m["ideaId"] for m in view["matches"]]
    assert idea(3)["id"] not in ids and len(ids) == 5
    assert view["matches"][0]["reasons"][0].startswith("Looking for backend")


async def test_need_message_when_profile_is_empty(fake_node):
    fake_node.match_people["65f0000000000000000000b9"] = {"id": "65f0000000000000000000b9", "role": "Investor", "interests": [], "stageFocus": [],
                                                           "minCheck": None, "maxCheck": None, "keywords": [], "thesis": "", "saved": [], "committed": []}
    view = await deal_flow.current("65f0000000000000000000b9", "Investor")
    assert view["matches"] == [] and "sectors" in view["need"]


async def test_actions_and_reach_counts(pool):
    from app.core.errors import NotFound
    view = await deal_flow.current(INV, "Investor")
    founder_view = await deal_flow.current(FOUNDER, "Founder")
    both = next(m for m in view["matches"] if m["ideaId"] in {f["ideaId"] for f in founder_view["matches"]})
    assert (await deal_flow.act(INV, both["id"], "passed"))["status"] == "passed"
    with pytest.raises(NotFound):
        await deal_flow.act(FOUNDER, both["id"], "saved")  # not theirs
    assert await deal_flow.reach(both["ideaId"]) == {"investors": 1, "founders": 1, "days": 7}
    own = idea(3)["id"]
    assert (await deal_flow.reach(own))["founders"] == 0, "never shown to its own founder"


async def test_scheduler_queues_due_people_and_notifies(pool):
    queued = await deal_flow.schedule_batches()
    assert queued == 2
    await jobs.worker.drain()
    keys = {n["key"] for n in pool.notifications}
    assert any(k.startswith("deal-flow:") for k in keys) and len(pool.notifications) == 2
    assert await deal_flow.schedule_batches() == 0, "not due again for 7 days"


async def test_an_empty_profile_batch_does_not_hold_back_the_first_real_one(fake_node, pool):
    uid = "65f0000000000000000000b8"
    person = {"id": uid, "role": "Investor", "interests": [], "stageFocus": [], "minCheck": None, "maxCheck": None,
              "keywords": [], "thesis": "", "saved": [], "committed": []}
    fake_node.match_people[uid] = person
    assert (await deal_flow.current(uid, "Investor"))["need"]
    assert (await deal_flow.current(uid, "Investor"))["need"], "still empty: no new batch piles up"
    assert await db.col("agent_match_batches").count_documents({"user_id": uid}) == 1
    fake_node.match_people[uid] = {**person, "interests": ["climate"]}
    view = await deal_flow.current(uid, "Investor")
    assert view["need"] is None and len(view["matches"]) == 5, "sectors added: matches right away, not in 7 days"
