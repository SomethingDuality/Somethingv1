"""Embeddings for matching, cached by text hash (agent_vectors), so a weekly batch re-embeds only
what changed. Purged with the idea or the user (shared/agent-collections.json)."""
import hashlib

import numpy as np

from app.core import db
from app.memory.store import to_binary, to_vec
from app.models import embeddings


def _h(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:32]


async def vectors(items: list[dict], ctx: dict | None = None) -> dict[str, np.ndarray]:
    """items: [{key, text, user_id?, idea_id?}] → {key: unit vector}."""
    model = embeddings.model_name()
    want = {it["key"]: it for it in items if it.get("text")}
    out: dict[str, np.ndarray] = {}
    async for doc in db.col("agent_vectors").find({"_id": {"$in": list(want)}, "model": model}):
        if doc.get("hash") == _h(want[doc["_id"]]["text"]):
            out[doc["_id"]] = to_vec(doc["embedding"])
    missing = [it for k, it in want.items() if k not in out]
    for i in range(0, len(missing), 64):
        chunk = missing[i:i + 64]
        vecs = await embeddings.embed([c["text"][:2000] for c in chunk], ctx=ctx)
        for c, v in zip(chunk, vecs, strict=True):
            out[c["key"]] = v
            await db.col("agent_vectors").update_one({"_id": c["key"]}, {"$set": {
                "hash": _h(c["text"]), "model": model, "embedding": to_binary(v),
                **({"user_id": c["user_id"]} if c.get("user_id") else {}), **({"idea_id": c["idea_id"]} if c.get("idea_id") else {}),
            }}, upsert=True)
    return out
