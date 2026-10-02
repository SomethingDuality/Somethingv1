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


TZ_CHANGE_AFTER = timedelta(days=30)


async def pinned_tz(user_id: str, tz: str | None) -> str:
    """The time zone a user's day is counted in. The browser sends it, so it's pinned: switching
    zones would otherwise open a fresh "today" up to three times in one real day. It follows a
    real move once a month."""
    want = tz if tz and _zone(tz) is not timezone.utc else "UTC"
    col, now = db.col("agent_quotas"), datetime.now(timezone.utc)
    try:
        doc = await col.find_one_and_update(
            {"_id": f"{user_id}:tz"}, {"$setOnInsert": {"tz": want, "at": now, "user_id": user_id}},
            upsert=True, return_document=True,
        )
    except DuplicateKeyError:  # created by a parallel request
        doc = await col.find_one({"_id": f"{user_id}:tz"})
    if doc["tz"] != want and doc["at"] < now - TZ_CHANGE_AFTER:
        await col.update_one({"_id": doc["_id"], "at": doc["at"]}, {"$set": {"tz": want, "at": now}})
        return want
    return doc["tz"]


async def peek(user_id: str, feature: str, limit: int, tz: str | None = None) -> dict:
    day, resets = day_window(await pinned_tz(user_id, tz))
    doc = await db.col("agent_quotas").find_one({"_id": _key(user_id, feature, day)})
    return {"used": (doc or {}).get("used", 0), "limit": limit, "resetsAt": resets.isoformat()}


async def consume(user_id: str, feature: str, limit: int, tz: str | None = None) -> dict:
    """Takes one use of today's quota. The result's `day` is what `refund` needs."""
    day, resets = day_window(await pinned_tz(user_id, tz))
    key = _key(user_id, feature, day)
    quotas = db.col("agent_quotas")
    take = {"$inc": {"used": 1}}
    try:
        doc = await quotas.find_one_and_update(
            {"_id": key, "used": {"$lt": limit}},
            {**take, "$setOnInsert": {"user_id": user_id, "feature": feature, "expires_at": resets + timedelta(days=2)}},
            upsert=True, return_document=True,
        )
    except DuplicateKeyError:
        # The row exists: either at the limit, or a parallel first request just created it.
        doc = await quotas.find_one_and_update({"_id": key, "used": {"$lt": limit}}, take, return_document=True)
    if not doc:
        raise QuotaExceeded(used=limit, limit=limit, resetsAt=resets.isoformat())
    return {"used": doc["used"], "limit": limit, "resetsAt": resets.isoformat(), "day": day}


async def refund(user_id: str, feature: str, day: str) -> None:
    """Give a use back when the failure was ours (the founder shouldn't lose a review to a 503).
    `day` is the one the use was taken from, even if the founder's day has changed since."""
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
