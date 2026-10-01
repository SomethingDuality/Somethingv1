"""Matched deal flow, every 7 days (Somay, 2026-10-02; replaces P2's 4 days).

  Investors get up to 5 public ideas that fit them, each with plain reasons; they message the
  founder from the brief (the existing chat request), save it, or pass.
  Founders get up to 5 ideas looking for someone with their skills; "Ask to join" opens the
  existing co-founder chat.
  An idea is never shown to the same person twice, and never if they saved or committed to it.
  The founder of an idea sees only counts ("shown to 4 investors this week"), never who:
  Ghost Mode holds.

The first batch is made when the person first opens it; after that the scheduler makes one every
7 days and sends a notification when there is something in it."""
import uuid
from datetime import datetime, timedelta, timezone

from app.brain import packets
from app.brain.matcher import get_matcher, similarity
from app.brain.vectors import vectors
from app.core import db, jobs, node_client
from app.core.errors import InvalidInput, NotFound
from app.core.log import log
from app.core.settings import get_settings
from app.shared import taxonomy

NEED = {
    "Investor": "Add your sectors or the stages you back, and matched ideas arrive every week.",
    "Founder": "Add your skills, and ideas looking for someone like you arrive every week.",
}
ACTIONS = {"opened", "saved", "passed", "asked"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _pool(person: dict) -> list[dict]:
    raw = await node_client.match_ideas()
    shown = {m["idea_id"] async for m in db.col("agent_matches").find({"user_id": person["id"]}, {"idea_id": 1})}
    keep = [r for r in raw if r["id"] not in person["exclude"] and r["id"] not in shown and r["founderId"] != person["id"]]
    facts = await packets.memory_facts([r["id"] for r in keep])
    return [packets.idea_packet(r, facts.get(r["id"])) for r in keep]


async def build_batch(user_id: str, *, reason: str = "weekly") -> dict:
    """Makes (or returns) this person's batch. Idempotent per cadence window."""
    s = get_settings()
    raw = await node_client.match_user(user_id)
    person = packets.person_packet(raw)
    last = await db.col("agent_match_batches").find_one({"user_id": user_id}, sort=[("created_at", -1)])
    # A batch made before the profile was ready doesn't count toward the 7 days: the first real one
    # comes as soon as there's something to match on.
    if last and last.get("ready") and last["created_at"] > _now() - timedelta(days=s.match_cadence_days):
        return last
    if last and not last.get("ready") and not person["ready"]:
        return last  # still nothing to match on: don't pile up empty batches
    batch_id = uuid.uuid4().hex
    matches = []
    if person["ready"]:
        pool = await _pool(person)
        ctx = {"feature": "matching", "node": "vectors", "user_id": user_id}
        items = [{"key": f"idea:{i['id']}", "text": i["text"], "idea_id": i["id"]} for i in pool]
        items.append({"key": f"user:{user_id}", "text": person["text"], "user_id": user_id})
        vecs = await vectors(items, ctx=ctx)
        sims = similarity(vecs.get(f"user:{user_id}"), {i["id"]: vecs[f"idea:{i['id']}"] for i in pool if f"idea:{i['id']}" in vecs})
        matches = await get_matcher().ideas_for(person, pool, sims, s.match_batch_size)
        by_id = {i["id"]: i for i in pool}
        now = _now()
        for rank, m in enumerate(matches, 1):
            i = by_id[m.idea_id]
            await db.col("agent_matches").update_one({"user_id": user_id, "idea_id": m.idea_id}, {"$setOnInsert": {
                "_id": uuid.uuid4().hex, "batch_id": batch_id, "audience": person["role"].lower(), "rank": rank,
                "score": m.score, "parts": m.parts, "reasons": m.reasons, "matcher": get_matcher().name,
                "idea": {k: i[k] for k in ("title", "description", "sectors", "stage", "raising", "looking_for", "founder_location")},
                "status": "new", "created_at": now,
            }}, upsert=True)
    batch = {
        "_id": batch_id, "user_id": user_id, "role": person["role"], "reason": reason, "created_at": _now(),
        "size": len(matches), "ready": person["ready"], "matcher": get_matcher().name, "packet_version": packets.PACKET_VERSION,
    }
    await db.col("agent_match_batches").insert_one(batch)
    log("deal_flow.batch", user=user_id, role=person["role"], size=len(matches), reason=reason)
    return batch


def _view_match(m: dict) -> dict:
    i = m["idea"]
    return {
        "id": m["_id"], "ideaId": m["idea_id"], "status": m["status"], "reasons": m["reasons"],
        "idea": {"title": i["title"], "excerpt": (i.get("description") or "")[:220], "sectors": i.get("sectors", []),
                 "stage": i.get("stage"), "stageLabel": taxonomy.label("ideaStages", i["stage"]) if i.get("stage") else None,
                 "raising": i.get("raising"), "raisingLabel": taxonomy.label("raisingBands", i["raising"]) if i.get("raising") else None,
                 "lookingFor": [taxonomy.label("roles", r) for r in i.get("looking_for", [])], "location": i.get("founder_location", "")},
    }


async def current(user_id: str, role: str) -> dict:
    if role not in ("Investor", "Founder"):
        raise InvalidInput("role")
    batch = await db.col("agent_match_batches").find_one({"user_id": user_id}, sort=[("created_at", -1)])
    if not batch or not batch.get("ready"):
        batch = await build_batch(user_id, reason="first")
    matches = [m async for m in db.col("agent_matches").find({"batch_id": batch["_id"]}).sort("rank", 1)]
    next_at = batch["created_at"] + timedelta(days=get_settings().match_cadence_days)
    return {
        "batch": {"id": batch["_id"], "createdAt": batch["created_at"].isoformat(), "nextAt": next_at.isoformat(), "size": batch["size"]},
        "matches": [_view_match(m) for m in matches],
        "need": None if batch.get("ready") else NEED[role],
        "matcher": batch.get("matcher"),
    }


async def act(user_id: str, match_id: str, action: str) -> dict:
    if action not in ACTIONS:
        raise InvalidInput("action")
    res = await db.col("agent_matches").update_one({"_id": match_id, "user_id": user_id},
                                                   {"$set": {"status": action, f"actions.{action}": _now()}})
    if not res.matched_count:
        raise NotFound("match")
    return {"ok": True, "status": action}


async def reach(idea_id: str, days: int = 7) -> dict:
    """How many people an idea was matched to lately: counts only, never who."""
    since = _now() - timedelta(days=days)
    counts = {"investor": 0, "founder": 0}
    async for row in await db.col("agent_matches").aggregate([
        {"$match": {"idea_id": idea_id, "created_at": {"$gte": since}}},
        {"$group": {"_id": "$audience", "n": {"$sum": 1}}},
    ]):
        counts[row["_id"]] = row["n"]
    return {"investors": counts["investor"], "founders": counts["founder"], "days": days}


# ---- the weekly scheduler -----------------------------------------------------------------------

@jobs.handler("deal_flow_batch")
async def deal_flow_batch(job: dict) -> None:
    user_id = job["payload"]["user_id"]
    before = await db.col("agent_match_batches").find_one({"user_id": user_id}, sort=[("created_at", -1)])
    batch = await build_batch(user_id, reason="weekly")
    if before and before["_id"] == batch["_id"]:
        return  # not due yet
    if batch["size"]:
        role = batch["role"]
        text = (f"{batch['size']} new {'idea' if batch['size'] == 1 else 'ideas'} matched to you this week."
                if role == "Investor" else
                f"{batch['size']} {'idea is' if batch['size'] == 1 else 'ideas are'} looking for someone with your skills.")
        await node_client.notify(user_id, text, key=f"deal-flow:{batch['_id']}", link="/investor" if role == "Investor" else "/founder")


@jobs.periodic(1800)
async def schedule_batches() -> int:
    """Every 30 minutes: queue a batch for anyone whose last one is 7 days old. Someone who never
    opened their matches gets their first batch here too, once their profile is ready."""
    due_before = _now() - timedelta(days=get_settings().match_cadence_days)
    queued = 0
    for role in ("Investor", "Founder"):
        after = None
        while True:
            ids = await node_client.match_users(role, after)
            if not ids:
                break
            last = {b["_id"]: b["at"] async for b in await db.col("agent_match_batches").aggregate([
                {"$match": {"user_id": {"$in": ids}, "ready": True}}, {"$group": {"_id": "$user_id", "at": {"$max": "$created_at"}}}])}
            for uid in ids:
                if uid in last and last[uid] > due_before:
                    continue
                window = (last.get(uid) or _now()).strftime("%Y%m%d")
                if await jobs.enqueue("deal_flow_batch", f"m:{uid}", user_id=uid, payload={"user_id": uid},
                                      dedupe_key=f"deal-flow:{uid}:{window}"):
                    queued += 1
            after = ids[-1]
    return queued
