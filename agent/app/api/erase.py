"""Deletion (P16). Node deletes every agent_* row and checkpoint directly (shared/agent-collections.json);
this endpoint stops anything still running for that user or those ideas, so nothing writes the
data back after it's gone."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import Caller, service
from app.core.jobs import worker
from app.core.runs import manager

router = APIRouter(prefix="/internal", tags=["erase"])


class EraseIn(BaseModel):
    userId: str | None = None
    ideaIds: list[str] = []


@router.post("/erase")
async def erase(body: EraseIn, _caller: Caller = Depends(service)):
    # Jobs first (a job can start a memory run), then runs; both wait for what's running here.
    cancelled = 0
    if body.ideaIds:
        await worker.cancel_matching(idea_ids=body.ideaIds)
        cancelled += await manager.cancel_matching({"idea_id": {"$in": body.ideaIds}})
    if body.userId:
        await worker.cancel_matching(user_id=body.userId)
        cancelled += await manager.cancel_matching({"user_id": body.userId})
    return {"cancelled": cancelled}
