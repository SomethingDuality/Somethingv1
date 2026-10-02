"""R12 confirms: resolving them (the founder answered in the Something box) and expiring them.
A confirm left unanswered for CONFIRM_TTL_DAYS expires: memory doesn't change."""
import asyncio
from datetime import datetime, timezone

from app.core import db, jobs, node_client
from app.core.errors import NotFound
from app.core.log import warn
from app.core.runs import manager

CHOICES = {"yes": "accepted", "change": "changed", "skip": "skipped"}


async def resolve(confirm_id: str, user_id: str, choice: str, value: str | None = None) -> dict:
    """The run is resumed first and the confirm closed after, so an answer that can't reach its run
    (it hasn't paused yet, or died and will ask again) leaves the confirm open, never orphaned."""
    if choice not in CHOICES:
        raise NotFound("choice")
    if choice == "change" and not (value or "").strip():
        choice = "skip"
    confirms = db.col("agent_pending_confirms")
    doc = await confirms.find_one({"_id": confirm_id, "user_id": user_id, "status": "open"})
    if not doc:
        raise NotFound(f"confirm {confirm_id}")
    for _ in range(25):  # the question reaches Node a moment before the run pauses
        try:
            await manager.resume(doc["run_id"], {"choice": choice, "value": value})
            break
        except NotFound:
            run = await db.col("agent_runs").find_one({"_id": doc["run_id"]}, {"status": 1})
            if not run or run["status"] not in ("queued", "running"):
                raise
            await asyncio.sleep(0.2)
    else:
        raise NotFound(f"run for confirm {confirm_id} is not waiting yet")
    await confirms.update_one(
        {"_id": confirm_id, "status": "open"},
        {"$set": {"status": CHOICES[choice], "resolved_at": datetime.now(timezone.utc), "answer": {"choice": choice, "value": value}}},
    )
    return {"ok": True, "status": CHOICES[choice]}


@jobs.periodic(600)
async def expire_confirms() -> int:
    n = 0
    now = datetime.now(timezone.utc)
    async for doc in db.col("agent_pending_confirms").find({"status": "open", "expires_at": {"$lt": now}}):
        claimed = await db.col("agent_pending_confirms").update_one({"_id": doc["_id"], "status": "open"},
                                                                    {"$set": {"status": "expired", "resolved_at": now}})
        if not claimed.modified_count:
            continue
        try:
            await manager.resume(doc["run_id"], {"choice": "expired"})
        except NotFound:
            warn("confirms.expire_no_run", confirm=doc["_id"])
        try:
            await node_client.delete_question(doc["_id"])
        except Exception as e:  # noqa: BLE001 - Node's copy expires on its own date too; logged
            warn("confirms.node_delete_failed", confirm=doc["_id"], error=type(e).__name__)
        n += 1
    return n
