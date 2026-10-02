"""Starting and reading reviews. One review = one run of the review graph (RunManager), one
agent_reviews document, one use of today's quota (R7: 3 a day; the founder's local day). A review
that fails on our side gives the use back."""
import asyncio
import uuid
from datetime import datetime, timezone

from app.core import db, node_client, quotas
from app.core.checkpointer import thread_id
from app.core.errors import InvalidInput, NotFound
from app.core.runs import manager
from app.core.settings import get_settings
from app.review import store
from app.router.classify import classify

FEATURE = "review"


def limits() -> dict:
    s = get_settings()
    return {"nothing_samples": s.nothing_samples, "min_samples": 2, "min_agreeing_votes": 2,
            "max_rebuttal_rounds": s.max_rebuttal_rounds, "max_risks_shown": 3, "max_minor_per_sample": 2}


async def status(user_id: str, tz: str | None) -> dict:
    s = get_settings()
    return {"live": True, "fakeModels": s.agent_fake_llm, "quota": await quotas.peek(user_id, FEATURE, s.reviews_per_day, tz)}


async def start(user_id: str, tz: str | None, *, idea_id: str | None, text: str | None, readers: list[str]) -> dict:
    readers = [r for r in ("something", "nothing") if r in set(readers or [])]
    if not readers:
        raise InvalidInput("no readers")
    if not idea_id:
        text = (text or "").strip()
        route = classify(text)
        if route["kind"] != "new_idea":
            return {"kind": "general", "reply": route["reply"]}
        if len(text) > 2000:
            raise InvalidInput("too long")
    # Theirs (Node answers 404 for someone else's idea) and within budget, before a use is taken.
    await asyncio.gather(node_client.context(user_id, idea_id=idea_id) if idea_id else asyncio.sleep(0), quotas.check_budget())
    quota = await quotas.consume(user_id, FEATURE, get_settings().reviews_per_day, tz)
    review_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    subject = "saved_idea" if idea_id else "typed_text"
    lim = limits()
    await db.col("agent_reviews").insert_one({
        "_id": review_id, "user_id": user_id, "idea_id": idea_id, "subject": subject, "readers": readers,
        "input": {"text": text} if subject == "typed_text" else {}, "status": "running", "created_at": now,
        "quota_day": quota["day"], "tz": tz,
        "view": {"reviewId": review_id, "status": "running", "readers": readers, "subject": subject, "ideaId": idea_id,
                 "round": 0, "maxRounds": lim["max_rebuttal_rounds"], "brief": None, "nothing": None, "something": None, "error": None},
    })
    state = {"review_id": review_id, "user_id": user_id, "idea_id": idea_id, "subject": subject, "readers": readers,
             "limits": lim, "round": 0, "status": "running"}
    if subject == "typed_text":
        state["typed_text"] = text
    await manager.start("review", thread_id=thread_id(user_id, "review", review_id, idea_id), user_id=user_id,
                        idea_id=idea_id, input=state, run_id=review_id, meta={"review_id": review_id, "tz": tz})
    return {"kind": "review", "reviewId": review_id, "quota": {k: quota[k] for k in ("used", "limit", "resetsAt")}}


async def react(review_id: str, user_id: str, body: dict) -> dict:
    # The view says "waiting for you" a moment before the run actually pauses: give it that moment.
    for _ in range(30):
        run = await db.col("agent_runs").find_one({"_id": review_id, "user_id": user_id, "kind": "review"})
        if not run:
            raise NotFound("review")
        if run["status"] not in ("queued", "running"):
            break
        await asyncio.sleep(0.1)
    if run["status"] != "interrupted":
        raise InvalidInput("not waiting for a reaction")
    await manager.resume(review_id, {"kind": body.get("kind"), "risk_id": body.get("riskId"), "text": body.get("text", "")})
    return {"ok": True}


async def remove(review_id: str, user_id: str) -> dict:
    doc = await db.col("agent_reviews").find_one({"_id": review_id, "user_id": user_id}, {"_id": 1})
    if not doc:
        raise NotFound("review")
    await manager.cancel(review_id)
    run = await db.col("agent_runs").find_one({"_id": review_id}, {"thread_id": 1})
    await db.col("agent_reviews").delete_one({"_id": review_id})
    store.forget(review_id)
    await db.col("agent_run_events").delete_many({"run_id": review_id})
    await db.col("agent_runs").delete_one({"_id": review_id})
    await db.col("agent_chats").delete_many({"review_id": review_id, "user_id": user_id})
    if run:
        await db.db()["agent_checkpoints"].delete_many({"thread_id": run["thread_id"]})
        await db.db()["agent_checkpoint_writes"].delete_many({"thread_id": run["thread_id"]})
    return {"ok": True}


# Failures that are the founder's own keep the use; every other failure (ours: a provider, a
# timeout, a bug) gives it back.
FOUNDERS_OWN = {"invalid_input", "judge_refused", "not_found", "quota_exceeded"}


async def on_finish(run: dict, values: dict) -> None:
    """After the graph ends (complete or failed): store the outcome; give the use back when we
    failed. It can run twice (a crash right after it), so the refund happens once, atomically."""
    reviews = db.col("agent_reviews")
    failed = values.get("status") == "failed"
    update = {"status": "failed" if failed else "complete", "completed_at": datetime.now(timezone.utc)}
    if failed:
        err = values.get("error") or {}
        update.update({"view.status": "failed", "view.error": {k: err.get(k) for k in ("code", "message", "retryable")}})
    await reviews.update_one({"_id": run["_id"]}, {"$set": update})
    store.forget(run["_id"])
    if failed and (values.get("error") or {}).get("code") not in FOUNDERS_OWN:
        claimed = await reviews.find_one_and_update({"_id": run["_id"], "refunded": {"$ne": True}}, {"$set": {"refunded": True}},
                                                    projection={"quota_day": 1, "user_id": 1})
        if claimed and claimed.get("quota_day"):
            await quotas.refund(claimed["user_id"], FEATURE, claimed["quota_day"])
