"""E_ANN, research version: exact cosine over the scope's current notes (no ANN: its recall loss
turns into silent duplicate facts, and a scope holds hundreds of notes, not millions), plus a
second path to the judge: every current note with the same slot, however different it reads.
No decay here: an old fact is exactly the one a new statement may contradict.
Vectors from another embedding model aren't comparable, so those notes only come in by slot."""
import numpy as np
from langgraph.types import Overwrite

from app.core.log import log
from app.memory import store
from app.memory.graph.state import MemoryWriteState
from app.models.embeddings import cosine_many


def _row(n: dict, cosine: float, same_slot: bool) -> dict:
    return {
        "note_id": n["_id"], "text": n["text"], "slot_key": n.get("slot_key"), "value": n.get("value"),
        "provenance": n["provenance"], "valid_at": n.get("valid_at"), "created_at": n["created_at"].isoformat(),
        "cosine": cosine, "same_slot": same_slot, "scope_key": n["scope_key"],
    }


async def search_node(state: MemoryWriteState) -> dict:
    scope, cand, limits = state["scope"], state["candidate"], state["limits"]
    version = await store.ensure_scope(scope)
    notes = await store.current_notes(store.read_keys(scope))
    slot = cand.get("slot_key")
    rows: dict[str, dict] = {}
    for n in notes:
        if slot and n.get("slot_key") == slot:
            rows[n["_id"]] = _row(n, 0.0, True)

    comparable = [n for n in notes if n.get("embedding") is not None and n.get("embedding_model") == state.get("embedding_model")]
    if comparable:
        query = np.asarray(state["embedding"], dtype=np.float32)
        sims = cosine_many(query, np.stack([store.to_vec(n["embedding"]) for n in comparable]))
        for i in np.argsort(-sims)[: limits["top_k"]]:
            n = comparable[int(i)]
            row = rows.get(n["_id"]) or _row(n, 0.0, False)
            row["cosine"] = float(sims[int(i)])
            rows[n["_id"]] = row
        # Calibration data for the gate (target: 300–500 labelled pairs).
        log("memory.gate_sample", scope=scope["scope_key"], best=round(float(sims.max()), 4), same_slot=any(r["same_slot"] for r in rows.values()))
    neighbours = sorted(rows.values(), key=lambda x: (not x["same_slot"], -x["cosine"]))
    return {"neighbours": neighbours, "scope_version": version, "judgements": Overwrite([])}
