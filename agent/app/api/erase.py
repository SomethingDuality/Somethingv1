"""Deletion (P16). Node deletes every agent_* row and checkpoint directly (shared/agent-collections.json);
this endpoint stops anything still running for that user or those ideas, so nothing writes the
data back after it's gone."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import Caller, service
from app.core import db
from app.core.runs import manager

router = APIRouter(prefix="/internal", tags=["erase"])


class EraseIn(BaseModel):
    userId: str | None = None
    ideaIds: list[str] = []


@router.post("/erase")
async def erase(body: EraseIn, _caller: Caller = Depends(service)):
    cancelled = 0
    if body.ideaIds:
        cancelled += await manager.cancel_matching({"idea_id": {"$in": body.ideaIds}})
        await db.col("agent_jobs").update_many({"idea_id": {"$in": body.ideaIds}, "status": {"$in": ["pending", "leased"]}}, {"$set": {"status": "cancelled"}})
    if body.userId:
        cancelled += await manager.cancel_matching({"user_id": body.userId})
        await db.col("agent_jobs").update_many({"user_id": body.userId, "status": {"$in": ["pending", "leased"]}}, {"$set": {"status": "cancelled"}})
    return {"cancelled": cancelled}
