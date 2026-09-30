"""Durable LangGraph checkpoints in Mongo, so a paused review (waiting for the founder) survives
restarts. RabbitHole used MemorySaver, which lost every thread on restart.

MongoDBSaver is sync only; LangGraph runs its calls in an executor. Thread ids carry the user
(and idea) so deletion can purge them by prefix (see thread_id())."""
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient

from app.core.settings import get_settings

_saver: MongoDBSaver | None = None
_sync_client: MongoClient | None = None

TTL_SECONDS = 90 * 24 * 3600


def saver() -> MongoDBSaver:
    global _saver, _sync_client
    if _saver is None:
        _sync_client = MongoClient(get_settings().mongo_uri, tz_aware=True)
        db_name = _sync_client.get_default_database().name
        _saver = MongoDBSaver(
            _sync_client,
            db_name=db_name,
            checkpoint_collection_name="agent_checkpoints",
            writes_collection_name="agent_checkpoint_writes",
            ttl=TTL_SECONDS,
        )
    return _saver


def thread_id(user_id: str, kind: str, run_key: str, idea_id: str | None = None) -> str:
    """u:<user>[:i:<idea>]:<kind>:<key>. Purge matches the u:/i: prefixes."""
    scope = f"u:{user_id}:i:{idea_id}" if idea_id else f"u:{user_id}:t"
    return f"{scope}:{kind}:{run_key}"


def close() -> None:
    global _saver, _sync_client
    if _sync_client is not None:
        _sync_client.close()
    _saver, _sync_client = None, None
