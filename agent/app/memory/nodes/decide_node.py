from app.memory.decide import decide
from app.memory.graph.state import MemoryWriteState


async def decide_node(state: MemoryWriteState) -> dict:
    """E_DECIDE: the pure table in memory/decide.py."""
    return {"decision": decide(state["candidate"], state.get("neighbours") or [], state.get("judgements") or [])}
