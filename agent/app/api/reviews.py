"""Reviews, called by Node for a signed-in founder (Node returns 403 to investors: R9)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api import sse
from app.api.deps import Caller, require_user, service
from app.core.runs import manager
from app.review import service as reviews
from app.review import store

router = APIRouter(prefix="/internal/reviews", tags=["reviews"])


class StartIn(BaseModel):
    ideaId: str | None = Field(default=None, pattern=r"^[a-f0-9]{24}$")
    text: str | None = Field(default=None, max_length=2000)
    readers: list[Literal["something", "nothing"]] = ["something", "nothing"]


class ReactIn(BaseModel):
    kind: Literal["accept", "dispute", "done"]
    riskId: str | None = Field(default=None, pattern=r"^a[1-6]$")
    text: str | None = Field(default=None, max_length=1500)


def _founder(caller: Caller) -> str:
    if caller.role != "Founder":
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Reviews are for founders."})
    return require_user(caller)


@router.get("/status")
async def review_status(caller: Caller = Depends(service)):
    return await reviews.status(_founder(caller), caller.tz)


@router.post("")
async def start(body: StartIn, caller: Caller = Depends(service)):
    if not body.ideaId and not (body.text or "").strip():
        raise HTTPException(status_code=422, detail={"code": "invalid_input", "message": "Pick an idea or write one."})
    return await reviews.start(_founder(caller), caller.tz, idea_id=body.ideaId, text=body.text, readers=body.readers)


async def _with_last_event(doc: dict, seq: int) -> dict:
    """The view plus the run's last event id, so a reloaded page resumes the stream after it
    (replaying from 0 would bring back old pauses). The id is read before the view: an event in
    between is then replayed (applying it twice changes nothing), never skipped."""
    return {**doc["view"], "lastEventId": seq}


async def _seq(review_id: str) -> int:
    return await manager.last_seq(review_id)


@router.get("/latest")
async def latest(ideaId: str | None = None, caller: Caller = Depends(service)):
    user_id = _founder(caller)
    head = await store.latest(user_id, ideaId)
    if not head:
        return {"review": None}
    seq = await _seq(head["_id"])
    doc = await store.get(head["_id"], user_id) or head
    return {"review": await _with_last_event(doc, seq)}


@router.get("/{review_id}")
async def get_one(review_id: str, caller: Caller = Depends(service)):
    user_id = _founder(caller)
    seq = await _seq(review_id)
    doc = await store.get(review_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Not found."})
    return {"review": await _with_last_event(doc, seq)}


@router.get("/{review_id}/stream")
async def stream(review_id: str, after: int = 0, caller: Caller = Depends(service)):
    if not await store.get(review_id, _founder(caller)):
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Not found."})
    return sse.stream(review_id, after)


@router.post("/{review_id}/react")
async def react(review_id: str, body: ReactIn, caller: Caller = Depends(service)):
    if body.kind != "done" and not body.riskId:
        raise HTTPException(status_code=422, detail={"code": "invalid_input", "message": "Which risk?"})
    return await reviews.react(review_id, _founder(caller), body.model_dump())


@router.delete("/{review_id}")
async def delete(review_id: str, caller: Caller = Depends(service)):
    return await reviews.remove(review_id, _founder(caller))
