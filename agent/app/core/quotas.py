"""Per-user daily quotas (R7: 3 reviews a day) and a global daily spend breaker.

Quotas are the one cost control that can't be gamed, and they also cap how many times a founder
can retry an injection against the judge. Counting is atomic: a conditional $inc never passes
the limit, even with parallel requests."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pymongo.errors import DuplicateKeyError

from app.core import db
from app.core.errors import BudgetPaused, QuotaExceeded
from app.core.settings import get_settings


def _zone(tz: str | None):
    try:
        return ZoneInfo(tz) if tz else timezone.utc
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


def day_window(tz: str | None, now: datetime | None = None) -> tuple[str, datetime]:
    """The user's local day as YYYY-MM-DD, and when it ends (UTC)."""
    zone = _zone(tz)
    local = (now or datetime.now(timezone.utc)).astimezone(zone)
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    end = (start + timedelta(days=1)).astimezone(timezone.utc)
    return start.date().isoformat(), end


def _key(user_id: str, feature: str, day: str) -> str:
    return f"{user_id}:{feature}:{day}"


async def peek(user_id: str, feature: str, limit: int, tz: str | None = None) -> dict:
    day, resets = day_window(tz)
    doc = await db.col("agent_quotas").find_one({"_id": _key(user_id, feature, day)})
    return {"used": (doc or {}).get("used", 0), "limit": limit, "resetsAt": resets.isoformat()}


async def consume(user_id: str, feature: str, limit: int, tz: str | None = None) -> dict:
    day, resets = day_window(tz)
    key = _key(user_id, feature, day)
    quotas = db.col("agent_quotas")
    try:
        doc = await quotas.find_one_and_update(
            {"_id": key, "used": {"$lt": limit}},
            {"$inc": {"used": 1}, "$setOnInsert": {"user_id": user_id, "feature": feature, "expires_at": resets + timedelta(days=2)}},
            upsert=True,
            return_document=True,
        )
    except DuplicateKeyError:
        # The day's row exists and is already at the limit, so the upsert tried to insert a twin.
        doc = None
    if not doc:
        raise QuotaExceeded(used=limit, limit=limit, resetsAt=resets.isoformat())
    return {"used": doc["used"], "limit": limit, "resetsAt": resets.isoformat()}


async def refund(user_id: str, feature: str, tz: str | None = None) -> None:
    """Give a use back when the failure was ours (the founder shouldn't lose a review to a 503)."""
    day, _ = day_window(tz)
    await db.col("agent_quotas").update_one({"_id": _key(user_id, feature, day), "used": {"$gt": 0}}, {"$inc": {"used": -1}})


async def check_budget() -> None:
    day, _ = day_window(None)
    doc = await db.col("agent_quotas").find_one({"_id": f"global:{day}"})
    if (doc or {}).get("usd", 0) >= get_settings().daily_usd_cap:
        raise BudgetPaused()


async def add_spend(usd: float) -> None:
    day, resets = day_window(None)
    await db.col("agent_quotas").update_one(
        {"_id": f"global:{day}"},
        {"$inc": {"usd": usd}, "$setOnInsert": {"expires_at": resets + timedelta(days=30)}},
        upsert=True,
    )
