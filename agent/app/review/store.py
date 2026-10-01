"""agent_reviews: one document per review, holding the founder-facing view after every step (so a
reload or a dropped stream shows the same thing the events built) plus the audit trail: brief,
samples, aggregate, rule trace, models and prompt versions. Founder-only (R9); deleted with the
idea or the account (P16)."""
from datetime import datetime, timezone

from app.core import db
from app.review.view import full_view

PROMPT_VERSIONS = {"brief": "review.brief.v1", "decompose": "review.decompose.v1", "nothing": "review.nothing.v1",
                   "steelman": "review.steelman.v1", "relay": "review.relay.v1", "rebuttal": "review.rebuttal.v1"}


async def save(state: dict, *, status: str | None = None, extra: dict | None = None) -> dict:
    s = {**state, **({"status": status} if status else {})}
    view = full_view(s)
    update = {
        "view": view, "status": view["status"], "updated_at": datetime.now(timezone.utc),
        "brief": state.get("brief"), "assumptions": state.get("assumptions"),
        "samples": state.get("nothing_samples"), "aggregate": state.get("aggregate"),
        "verdict": state.get("verdict"), "steelman": state.get("steelman"), "rebuttals": state.get("rebuttals", []),
        "injection_signals": state.get("injection_signals", []),
        "flagged_for_human": bool(state.get("injection_signals")),
        "prompt_versions": PROMPT_VERSIONS,
        **(extra or {}),
    }
    await db.col("agent_reviews").update_one({"_id": state["review_id"]}, {"$set": update})
    return view


async def get(review_id: str, user_id: str) -> dict | None:
    return await db.col("agent_reviews").find_one({"_id": review_id, "user_id": user_id}, {"view": 1, "status": 1, "idea_id": 1, "created_at": 1})


async def latest(user_id: str, idea_id: str | None = None) -> dict | None:
    q = {"user_id": user_id, **({"idea_id": idea_id} if idea_id else {})}
    return await db.col("agent_reviews").find_one(q, {"view": 1, "status": 1, "idea_id": 1, "created_at": 1}, sort=[("created_at", -1)])
