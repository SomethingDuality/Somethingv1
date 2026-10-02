"""Mongo access. The agent reads and writes only its own `agent_*` collections; anything Node owns
(users, ideas) is read through Node's /internal/context and written through /internal/apply-update.
The collection list is mirrored in shared/agent-collections.json, which Node uses to purge on
deletion (P16); tests fail if the two drift."""
from pymongo import ASCENDING, DESCENDING, AsyncMongoClient, IndexModel
from pymongo.errors import OperationFailure

from app.core.settings import get_settings

_client: AsyncMongoClient | None = None

DAY = 24 * 3600

INDEXES: dict[str, list[IndexModel]] = {
    "agent_notes": [
        IndexModel([("scope_key", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)]),
        IndexModel([("scope_key", ASCENDING), ("slot_key", ASCENDING), ("status", ASCENDING)]),
        # Exact-duplicate check (prefilter): same words, same scope.
        IndexModel([("scope_key", ASCENDING), ("text_key", ASCENDING), ("status", ASCENDING)], partialFilterExpression={"text_key": {"$type": "string"}}),
        IndexModel([("op_id", ASCENDING)], unique=True, partialFilterExpression={"op_id": {"$type": "string"}}),
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
    ],
    "agent_scopes": [
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
    ],
    "agent_memory_decisions": [
        IndexModel([("scope_key", ASCENDING), ("at", DESCENDING)]),
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
    ],
    "agent_pending_confirms": [
        IndexModel([("user_id", ASCENDING), ("status", ASCENDING)]),
        IndexModel([("status", ASCENDING), ("expires_at", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
    ],
    "agent_reviews": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)]),
        IndexModel([("idea_id", ASCENDING), ("created_at", DESCENDING)], sparse=True),
    ],
    "agent_runs": [
        IndexModel([("thread_id", ASCENDING)], unique=True),
        IndexModel([("candidate_id", ASCENDING), ("kind", ASCENDING)], sparse=True),  # memory: one run per candidate
        IndexModel([("status", ASCENDING), ("heartbeat_at", ASCENDING)]),
        IndexModel([("user_id", ASCENDING), ("started_at", DESCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
    ],
    "agent_run_events": [
        IndexModel([("run_id", ASCENDING), ("seq", ASCENDING)], unique=True),
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),  # Node's purge deletes by idea
        IndexModel([("at", ASCENDING)], expireAfterSeconds=7 * DAY),
    ],
    "agent_usage": [
        IndexModel([("user_id", ASCENDING), ("at", DESCENDING)]),
        IndexModel([("at", ASCENDING)], expireAfterSeconds=180 * DAY),
    ],
    "agent_events": [
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
        IndexModel([("received_at", ASCENDING)], expireAfterSeconds=30 * DAY),
    ],
    "agent_jobs": [
        IndexModel([("status", ASCENDING), ("scope_key", ASCENDING), ("created_at", ASCENDING)]),
        IndexModel([("dedupe_key", ASCENDING)], unique=True, partialFilterExpression={"dedupe_key": {"$type": "string"}}),
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
    ],
    # Matching (interim matcher now, Prapti's Brain later): what was shown to whom, per weekly batch.
    "agent_matches": [
        IndexModel([("user_id", ASCENDING), ("idea_id", ASCENDING)], unique=True),  # an idea is shown to someone once
        IndexModel([("batch_id", ASCENDING)]),
        IndexModel([("idea_id", ASCENDING), ("created_at", DESCENDING)]),
    ],
    "agent_match_batches": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)]),
    ],
    "agent_vectors": [
        IndexModel([("user_id", ASCENDING)], sparse=True),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
    ],
    "agent_chats": [
        IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)]),
        IndexModel([("idea_id", ASCENDING)], sparse=True),
        IndexModel([("review_id", ASCENDING)], sparse=True),
    ],
    "agent_quotas": [
        IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        IndexModel([("user_id", ASCENDING)], sparse=True),
    ],
}

# Created by MongoDBSaver; listed so purge and the drift test know about them.
CHECKPOINT_COLLECTIONS = ("agent_checkpoints", "agent_checkpoint_writes")


def client() -> AsyncMongoClient:
    global _client
    if _client is None:
        _client = AsyncMongoClient(get_settings().mongo_uri, tz_aware=True, uuidRepresentation="standard")
    return _client


def db():
    return client().get_default_database()


def col(name: str):
    assert name in INDEXES, f"unknown agent collection {name}"
    return db()[name]


async def ensure_indexes() -> None:
    """Creates the indexes. One whose options changed (a TTL, say) is rebuilt instead of failing
    the boot with IndexOptionsConflict."""
    for name, models in INDEXES.items():
        try:
            await db()[name].create_indexes(models)
        except OperationFailure as e:
            if e.code not in (85, 86):  # IndexOptionsConflict, IndexKeySpecsConflict
                raise
            for model in models:
                try:
                    await db()[name].create_indexes([model])
                except OperationFailure as e2:
                    if e2.code not in (85, 86):
                        raise
                    await db()[name].drop_index(model.document["name"])
                    await db()[name].create_indexes([model])


async def close() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
