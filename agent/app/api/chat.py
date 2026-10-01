"""The Something chat, for founders (Node returns 403 to investors)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import Caller, require_user, service
from app.chat import service as chat

router = APIRouter(prefix="/internal/chat", tags=["chat"])


class TurnIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    reviewId: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    ideaId: str | None = Field(default=None, pattern=r"^[a-f0-9]{24}$")


def _founder(caller: Caller) -> str:
    if caller.role != "Founder":
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "The chat is for founders."})
    return require_user(caller)


@router.post("")
async def turn(body: TurnIn, caller: Caller = Depends(service)):
    return await chat.turn(_founder(caller), caller.tz, body.text, review_id=body.reviewId, idea_id=body.ideaId)


@router.get("")
async def history(reviewId: str | None = None, ideaId: str | None = None, caller: Caller = Depends(service)):
    return {"messages": await chat.history(_founder(caller), reviewId, ideaId)}
