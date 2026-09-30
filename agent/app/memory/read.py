"""The read path (SO0 E_SCORE → E_RANK → E_REINFORCE, research version).

recall()  current notes only; rank = reciprocal-rank fusion of cosine and keyword (BM25-lite)
          ranks, plus a small boost for notes the founder keeps citing, minus decay by class:
          none for slot facts and decisions, slow (power law) for assumptions and options,
          fast for ephemera. All constants are uncalibrated and live here, not in prompts.
known()   the current value of a slot, no decay ("check the store first" before asking).
Reinforcement happens only when a note is cited (store.cite), never because it was retrieved.
"""
import math
import re
from collections import Counter
from datetime import datetime, timezone

import numpy as np

from app.memory import store
from app.memory.schemas import TIER
from app.models import embeddings

RRF_K = 60
CITE_BOOST = 0.05
HALF_LIFE_DAYS = {"none": None, "slow": 180.0, "fast": 14.0}
_TOKEN = re.compile(r"[a-z0-9]+")


def _tokens(t: str) -> list[str]:
    return _TOKEN.findall((t or "").lower())


def _bm25(query: str, docs: list[str], k1: float = 1.2, b: float = 0.75) -> list[float]:
    q = set(_tokens(query))
    toks = [_tokens(d) for d in docs]
    if not q or not toks:
        return [0.0] * len(docs)
    avg = sum(map(len, toks)) / len(toks) or 1.0
    df = Counter(t for doc in toks for t in set(doc))
    n = len(toks)
    out = []
    for doc in toks:
        tf = Counter(doc)
        s = 0.0
        for term in q:
            if tf[term]:
                idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
                s += idf * tf[term] * (k1 + 1) / (tf[term] + k1 * (1 - b + b * len(doc) / avg))
        out.append(s)
    return out


def _decay(note: dict, now: datetime) -> float:
    half = HALF_LIFE_DAYS.get(note.get("decay_class", "slow"))
    if not half:
        return 0.0
    age = max(0.0, (now - note["created_at"]).total_seconds() / 86400)
    return 1.0 - (1.0 + age / half) ** -0.5  # power law (ACT-R style), between 0 and 1


async def recall(keys: list[str], query: str, *, k: int = 8, exclude_sources: tuple[str, ...] = (),
                 kinds: tuple[str, ...] | None = None, ctx: dict | None = None) -> list[dict]:
    notes = [n for n in await store.current_notes(keys)
             if n.get("source", {}).get("type") not in exclude_sources and (kinds is None or n.get("kind") in kinds)]
    if not notes:
        return []
    now = datetime.now(timezone.utc)
    model = embeddings.model_name()
    [qv] = await embeddings.embed([query], task="retrieval.query", ctx=ctx)
    cos = np.array([float(store.to_vec(n["embedding"]) @ qv) if n.get("embedding") is not None and n.get("embedding_model") == model else 0.0 for n in notes])
    kw = np.array(_bm25(query, [n["text"] for n in notes]))
    rank_cos = {i: r for r, i in enumerate(np.argsort(-cos))}
    rank_kw = {i: r for r, i in enumerate(np.argsort(-kw))}
    scored = []
    for i, n in enumerate(notes):
        score = 1 / (RRF_K + rank_cos[i]) + 1 / (RRF_K + rank_kw[i])
        score *= (1 + CITE_BOOST * math.log1p(n.get("cite_count", 0)))
        score *= (1 - 0.5 * _decay(n, now))
        scored.append((score, n))
    scored.sort(key=lambda x: -x[0])
    return [store.public(n) for _, n in scored[:k]]


async def known(keys: list[str], slot_key: str) -> dict | None:
    """The current value of a slot. An idea's value overrides the founder's; within one scope a
    contested slot resolves by provenance tier, then the latest valid_at."""
    for key in keys:  # most specific scope first
        notes = [n for n in await store.current_notes([key], embeddings=False) if n.get("slot_key") == slot_key]
        if notes:
            notes.sort(key=lambda n: (TIER.get(n["provenance"], 0), str(n.get("valid_at") or "")), reverse=True)
            return store.public(notes[0])
    return None
