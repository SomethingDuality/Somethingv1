"""Reviews, called by Node for a signed-in founder (Node returns 403 to investors: R9)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api import sse
from app.api.deps import Caller, require_user, service
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


@router.get("/latest")
async def latest(ideaId: str | None = None, caller: Caller = Depends(service)):
    doc = await store.latest(_founder(caller), ideaId)
    return {"review": doc["view"] if doc else None}


@router.get("/{review_id}")
async def get_one(review_id: str, caller: Caller = Depends(service)):
    doc = await store.get(review_id, _founder(caller))
    if not doc:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Not found."})
    return {"review": doc["view"]}


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
