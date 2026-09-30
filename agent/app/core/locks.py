"""Scope leases (agent_scopes): memory writes for one founder, idea or investor run one at a time,
the Mongo analogue of a Kafka partition key. The version field guards each commit (locks expire;
the version check is what actually prevents two writers both "winning")."""
from datetime import datetime, timedelta, timezone

from pymongo.errors import DuplicateKeyError

from app.core import db


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def acquire(scope_key: str, owner: str, ttl_s: int = 120, **fields) -> bool:
    now = _now()
    try:
        await db.col("agent_scopes").find_one_and_update(
            {"_id": scope_key, "$or": [{"lock": None}, {"lock.until": {"$lt": now}}, {"lock.owner": owner}]},
            {"$set": {"lock": {"owner": owner, "until": now + timedelta(seconds=ttl_s)}},
             "$setOnInsert": {"version": 0, **fields}},
            upsert=True,
        )
    except DuplicateKeyError:
        return False  # held by someone else (the upsert tried to create a twin)
    return True


async def release(scope_key: str, owner: str) -> None:
    await db.col("agent_scopes").update_one({"_id": scope_key, "lock.owner": owner}, {"$set": {"lock": None}})


async def version(scope_key: str) -> int:
    doc = await db.col("agent_scopes").find_one({"_id": scope_key}, {"version": 1})
    return int((doc or {}).get("version", 0))
