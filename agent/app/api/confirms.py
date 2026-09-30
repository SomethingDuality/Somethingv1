"""The founder answered a memory confirm in the Something box; Node forwards it here."""
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import Caller, require_user, service
from app.memory import confirms

router = APIRouter(prefix="/internal/confirms", tags=["memory"])


class ResolveIn(BaseModel):
    choice: Literal["yes", "change", "skip"]
    value: str | None = Field(default=None, max_length=200)


@router.post("/{confirm_id}/resolve")
async def resolve(confirm_id: str, body: ResolveIn, caller: Caller = Depends(service)):
    return await confirms.resolve(confirm_id, require_user(caller), body.choice, body.value)
