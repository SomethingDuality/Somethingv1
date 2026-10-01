"""Domain events forwarded by Node (idea.*, profile.updated, question.answered).

Events are hints: Node's documents are the truth, and each memory job reconciles from them.
Stored once per eventId (Node retries), then queued as a job serialised per scope."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from pymongo.errors import DuplicateKeyError

from app.api.deps import Caller, service
from app.core import db, jobs

router = APIRouter(prefix="/internal", tags=["events"])


class EventIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    eventType: str
    eventId: str
    occurredAt: str | None = None


@router.post("/events", status_code=202)
async def receive(event: EventIn, _caller: Caller = Depends(service)):
    payload = event.model_dump()
    user_id = payload.get("userId") or payload.get("founderId")
    idea_id = payload.get("ideaId")
    if payload.get("source") == "agent":
        return {"status": "ignored"}  # our own writes coming back: loop guard
    try:
        await db.col("agent_events").insert_one({
            "_id": event.eventId, "eventType": event.eventType, "user_id": user_id, "idea_id": idea_id,
            "payload": payload, "received_at": datetime.now(timezone.utc), "status": "received", "attempts": 0,
        })
    except DuplicateKeyError:
        return {"status": "duplicate"}
    queued = await jobs.enqueue_event(payload, user_id=user_id, idea_id=idea_id)
    return {"status": "queued" if queued else "ignored"}
