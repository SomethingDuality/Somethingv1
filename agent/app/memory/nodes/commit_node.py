"""E_TXN: one transaction per decision, opened only after embed → search → decide are done (no model
call inside a transaction). If another writer changed the scope since our search, search again;
after max_commit_attempts the run fails and the job is retried later (op_id keeps it idempotent)."""
import asyncio
import random

from app.memory import store
from app.memory.graph.state import MemoryWriteState


async def commit_node(state: MemoryWriteState) -> dict:
    attempts = state.get("commit_attempts", 0) + 1
    cand = state["candidate"]
    log = {
        "candidate": {k: v for k, v in cand.items() if k != "quote"},
        "neighbour_ids": [n["note_id"] for n in state.get("neighbours") or []],
        "judgements": state.get("judgements") or [],
        "confirm": state.get("confirm"),
        "prompt_version": "memory.judge.v1",
    }
    try:
        out = await store.commit(state["scope"], cand, state["decision"], embedding=state.get("embedding"),
                                 model=state.get("embedding_model", ""), expected_version=state.get("scope_version", 0), log=log)
    except store.VersionConflict:
        if attempts >= state["limits"]["max_commit_attempts"]:
            raise
        await asyncio.sleep(random.uniform(0.01, 0.05) * attempts)  # jitter, so racing writers spread out
        return {"commit_attempts": attempts, "outcome": "retry"}
    return {"commit_attempts": attempts, "outcome": out["outcome"], "written_note_ids": out["written_note_ids"]}
