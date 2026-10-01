"""Matched deal flow for investors and founders, and an idea's reach for its founder."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import Caller, require_user, service
from app.brain import deal_flow
from app.core import node_client
from app.core.errors import NotFound

router = APIRouter(prefix="/internal/deal-flow", tags=["matching"])


class ActIn(BaseModel):
    action: Literal["opened", "saved", "passed", "asked"]


@router.get("")
async def current(caller: Caller = Depends(service)):
    return await deal_flow.current(require_user(caller), caller.role or "")


@router.post("/{match_id}")
async def act(match_id: str, body: ActIn, caller: Caller = Depends(service)):
    return await deal_flow.act(require_user(caller), match_id, body.action)


@router.get("/reach/{idea_id}")
async def reach(idea_id: str, caller: Caller = Depends(service)):
    user_id = require_user(caller)
    try:
        await node_client.context(user_id, idea_id=idea_id, purpose="memory")  # 404 unless it's their idea
    except NotFound:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Not found."}) from None
    return await deal_flow.reach(idea_id)
