"""Embeddings: Jina v3, 1024-d (his RabbitHole choice). Every note stores the embedding model
and version, so a model change means re-embedding and re-calibrating the memory gate.

Fake mode uses feature hashing over words and word pairs: texts sharing words get a high cosine,
which is enough to exercise the gate and the neighbour search deterministically."""
import hashlib
import re
import time

import httpx
import numpy as np

from app.core import usage
from app.core.errors import ProviderUnavailable
from app.core.settings import get_settings

FAKE_MODEL = "fake-hash-v1"
_WORD = re.compile(r"[a-z0-9]+")


def model_name() -> str:
    s = get_settings()
    return FAKE_MODEL if s.agent_fake_llm else s.embedding_model


def _fake(text: str, dims: int) -> np.ndarray:
    v = np.zeros(dims, dtype=np.float32)
    words = _WORD.findall(text.lower())
    grams = words + [f"{a} {b}" for a, b in zip(words, words[1:], strict=False)]
    for g in grams:
        h = hashlib.blake2b(g.encode(), digest_size=8).digest()
        idx = int.from_bytes(h[:4], "little") % dims
        v[idx] += 1.0 if h[4] & 1 else -1.0
    n = np.linalg.norm(v)
    return v / n if n else v


async def embed(texts: list[str], *, task: str = "retrieval.passage", ctx: dict | None = None) -> list[np.ndarray]:
    s = get_settings()
    if not texts:
        return []
    if s.agent_fake_llm:
        return [_fake(t, s.embedding_dims) for t in texts]
    if not s.jina_api_key:
        raise ProviderUnavailable("JINA_API_KEY is not set")
    started = time.monotonic()
    try:
        res = await _http().post(
            "https://api.jina.ai/v1/embeddings",
            headers={"Authorization": f"Bearer {s.jina_api_key}"},
            json={"model": s.embedding_model, "task": task, "dimensions": s.embedding_dims, "input": texts},
        )
        res.raise_for_status()
        data = res.json()
    except httpx.HTTPError as e:
        await usage.record(ctx or {}, provider="jina", model=s.embedding_model, outcome="error", error_class=type(e).__name__)
        raise ProviderUnavailable(f"jina embeddings: {type(e).__name__}") from e
    tokens = (data.get("usage") or {}).get("total_tokens", 0)
    await usage.record(ctx or {}, provider="jina", model=s.embedding_model, tokens={"input_tokens": tokens},
                       latency_ms=int((time.monotonic() - started) * 1000))
    out = []
    for row in sorted(data["data"], key=lambda r: r["index"]):
        v = np.asarray(row["embedding"], dtype=np.float32)
        n = np.linalg.norm(v)
        out.append(v / n if n else v)
    return out


# One connection pool for the process (a client per call cost ~7 ms of CPU and a TLS handshake).
_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=20)
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def cosine_many(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Vectors are unit length, so cosine is a dot product. Exact (no ANN): per-scope note sets
    are hundreds of rows, and ANN recall loss would turn into silent duplicate facts."""
    if matrix.size == 0:
        return np.zeros(0, dtype=np.float32)
    return matrix @ query
