"""Health: Mongo, checkpointer, job backlog, and which model providers are configured (booleans
only, never key values)."""
import asyncio

from fastapi import APIRouter, Depends

from app.api.deps import Caller, service
from app.core import db
from app.core.checkpointer import saver
from app.core.settings import get_settings
from app.models.llm import configured_providers

router = APIRouter(prefix="/internal", tags=["health"])


@router.get("/health")
async def health(_caller: Caller = Depends(service)):
    s = get_settings()
    mongo = "up"
    try:
        await db.db().command("ping")
    except Exception:  # noqa: BLE001 - reported as down, that's the point of a health check
        mongo = "down"
    checkpoints = "up"
    try:
        await asyncio.to_thread(lambda: saver().db.command("ping"))
    except Exception:  # noqa: BLE001
        checkpoints = "down"
    backlog = await db.col("agent_jobs").count_documents({"status": {"$in": ["pending", "leased"]}})
    dead = await db.col("agent_jobs").count_documents({"status": "dead"})
    return {
        "status": "ok" if mongo == checkpoints == "up" else "degraded",
        "mongo": mongo, "checkpoints": checkpoints, "jobs": {"backlog": backlog, "dead": dead},
        "fakeLlm": s.agent_fake_llm, "providers": configured_providers(), "embeddings": bool(s.jina_api_key) or s.agent_fake_llm,
    }
