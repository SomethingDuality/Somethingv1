from langgraph.graph import END
from langgraph.types import Send

from app.memory.graph.state import MemoryWriteState


def route_prefilter(state: MemoryWriteState):
    return END if state.get("outcome") in ("dropped", "noop") else "embed_node"


def route_gate(state: MemoryWriteState):
    """E_GATE: no same-slot note and nothing close enough → decide without a judge (ADD).
    Otherwise each of the closest notes is judged twice, in both orders (position bias check)."""
    neighbours = state.get("neighbours") or []
    limits = state["limits"]
    same_slot = [n for n in neighbours if n.get("same_slot")]
    close = [n for n in neighbours if n.get("cosine", 0) >= limits["gate_cosine"]]
    if not same_slot and not close:
        return "decide_node"
    picked = (same_slot + [n for n in close if not n.get("same_slot")])[: limits["max_judged"]]
    return [
        Send("judge_pair_node", {"scope": state["scope"], "candidate": state["candidate"], "note": n, "order": order})
        for n in picked for order in ("ab", "ba")
    ]


def route_decision(state: MemoryWriteState):
    return "request_confirm_node" if state["decision"].get("needs_confirm") else "commit_node"


def route_confirm(state: MemoryWriteState):
    # A corrected value goes back through the prefilter, which normalises it to the slot's ids.
    choice = (state.get("confirm") or {}).get("choice")
    return "prefilter_node" if choice == "change" else "commit_node"


def route_commit(state: MemoryWriteState):
    if state.get("outcome") == "retry":
        return "search_node"
    if state.get("outcome") in ("added", "updated", "invalidated"):
        return "sync_node_field_node"
    return END
