"""agent_reviews: one document per review, holding the founder-facing view after every step (so a
reload or a dropped stream shows the same thing the events built) plus the audit trail: brief,
samples, aggregate, rule trace, models and prompt versions. Founder-only (R9); deleted with the
idea or the account (P16)."""
import hashlib
import json
from collections import OrderedDict
from datetime import datetime, timezone

from app.core import db
from app.review.view import full_view

PROMPT_VERSIONS = {"brief": "review.brief.v1", "decompose": "review.decompose.v1", "nothing": "review.nothing.v1",
                   "steelman": "review.steelman.v1", "relay": "review.relay.v1", "rebuttal": "review.rebuttal.v1"}


# What this process last wrote per review (field -> digest), so a save sends only what changed:
# the samples, brief and aggregate are most of the bytes and stop changing after the first save.
# Forgetting is safe (the next save writes everything), so it's a small bounded LRU.
_written: OrderedDict[str, dict[str, str]] = OrderedDict()
_WRITTEN_MAX = 512


def _digest(value) -> str:
    return hashlib.blake2b(json.dumps(value, sort_keys=True, default=str).encode(), digest_size=12).hexdigest()


async def save(state: dict, *, status: str | None = None, extra: dict | None = None) -> dict:
    s = {**state, **({"status": status} if status else {})}
    view = full_view(s)
    fields = {
        "view": view, "status": view["status"],
        "brief": state.get("brief"), "assumptions": state.get("assumptions"),
        "samples": state.get("nothing_samples"), "aggregate": state.get("aggregate"),
        "verdict": state.get("verdict"), "steelman": state.get("steelman"), "rebuttals": state.get("rebuttals", []),
        "injection_signals": state.get("injection_signals", []),
        "flagged_for_human": bool(state.get("injection_signals")),
        "prompt_versions": PROMPT_VERSIONS,
        **(extra or {}),
    }
    review_id = state["review_id"]
    seen = _written.pop(review_id, {})
    digests = {k: _digest(v) for k, v in fields.items()}
    changed = {k: v for k, v in fields.items() if seen.get(k) != digests[k]}
    await db.col("agent_reviews").update_one({"_id": review_id}, {"$set": {**changed, "updated_at": datetime.now(timezone.utc)}})
    _written[review_id] = digests
    while len(_written) > _WRITTEN_MAX:
        _written.popitem(last=False)
    return view


def forget(review_id: str) -> None:
    """Something else wrote this review (the finisher, a delete): the next save writes it all."""
    _written.pop(review_id, None)


async def get(review_id: str, user_id: str) -> dict | None:
    return await db.col("agent_reviews").find_one({"_id": review_id, "user_id": user_id}, {"view": 1, "status": 1, "idea_id": 1, "created_at": 1})


async def latest(user_id: str, idea_id: str | None = None) -> dict | None:
    q = {"user_id": user_id, **({"idea_id": idea_id} if idea_id else {})}
    return await db.col("agent_reviews").find_one(q, {"view": 1, "status": 1, "idea_id": 1, "created_at": 1}, sort=[("created_at", -1)])
