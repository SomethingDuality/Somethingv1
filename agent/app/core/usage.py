"""Token and cost logging per model call (research: measure first). No content is stored:
only who, which feature, which model, how many tokens, how long, and the outcome."""
import json
from datetime import datetime, timezone
from pathlib import Path

from app.core import db
from app.core.quotas import add_spend

_PRICES = json.loads((Path(__file__).parent / "pricing.json").read_text())


def cost_usd(model: str, input_tokens: int = 0, output_tokens: int = 0, cache_read: int = 0, cache_write: int = 0) -> float:
    p = _PRICES.get(model, _PRICES["default"])
    plain_input = max(0, input_tokens - cache_read - cache_write)
    return round(
        (plain_input * p.get("input", 0)
         + output_tokens * p.get("output", 0)
         + cache_read * p.get("cache_read", p.get("input", 0))
         + cache_write * p.get("cache_write", p.get("input", 0))) / 1_000_000,
        6,
    )


def tokens_from(message) -> dict:
    """Read usage from a LangChain AIMessage (or None)."""
    meta = getattr(message, "usage_metadata", None) or {}
    details = meta.get("input_token_details") or {}
    return {
        "input_tokens": int(meta.get("input_tokens") or 0),
        "output_tokens": int(meta.get("output_tokens") or 0),
        "cache_read_input_tokens": int(details.get("cache_read") or 0),
        "cache_creation_input_tokens": int(details.get("cache_creation") or 0),
    }


async def record(ctx: dict, *, provider: str, model: str, tokens: dict | None = None, latency_ms: int = 0,
                 outcome: str = "ok", error_class: str | None = None, effort: str | None = None) -> float:
    tokens = tokens or {}
    usd = cost_usd(model, tokens.get("input_tokens", 0), tokens.get("output_tokens", 0),
                   tokens.get("cache_read_input_tokens", 0), tokens.get("cache_creation_input_tokens", 0))
    await db.col("agent_usage").insert_one({
        "at": datetime.now(timezone.utc),
        "user_id": ctx.get("user_id"),
        "feature": ctx.get("feature"),
        "node": ctx.get("node"),
        "run_id": ctx.get("run_id"),
        "review_id": ctx.get("review_id"),
        "provider": provider,
        "model": model,
        "effort": effort,
        **{k: tokens.get(k, 0) for k in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")},
        "latency_ms": latency_ms,
        "cost_usd_est": usd,
        "outcome": outcome,
        "error_class": error_class,
    })
    if usd:
        await add_spend(usd)
    return usd
