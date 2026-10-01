"""Phase A echo run: start, stream, resume. Not available in production."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api import sse
from app.api.deps import Caller, require_user, service
from app.core import db
from app.core.checkpointer import thread_id
from app.core.runs import manager
from app.core.settings import get_settings

router = APIRouter(prefix="/internal/diagnostics", tags=["diagnostics"])


class EchoIn(BaseModel):
    message: str = Field(max_length=200)
    explode_at: str | None = None


class ResumeIn(BaseModel):
    reply: str = Field(max_length=200)


def _guard():
    if get_settings().agent_env == "production":
        raise HTTPException(status_code=404)


async def _own_run(run_id: str, user_id: str) -> dict:
    run = await db.col("agent_runs").find_one({"_id": run_id, "user_id": user_id, "kind": "echo"})
    if not run:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Not found."})
    return run


@router.post("/echo")
async def start_echo(body: EchoIn, caller: Caller = Depends(service)):
    _guard()
    user_id = require_user(caller)
    key = uuid.uuid4().hex
    state = {"message": body.message}
    if body.explode_at:
        state["explode_at"] = body.explode_at
    run = await manager.start("echo", thread_id=thread_id(user_id, "echo", key), user_id=user_id, input=state, run_id=key)
    return {"runId": run["_id"]}


@router.get("/echo/{run_id}/stream")
async def stream_echo(run_id: str, after: int = 0, caller: Caller = Depends(service)):
    _guard()
    await _own_run(run_id, require_user(caller))
    return sse.stream(run_id, after)


@router.post("/echo/{run_id}/resume")
async def resume_echo(run_id: str, body: ResumeIn, caller: Caller = Depends(service)):
    _guard()
    await _own_run(run_id, require_user(caller))
    await manager.resume(run_id, body.reply)
    return {"ok": True}
