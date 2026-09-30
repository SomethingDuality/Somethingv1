"""Phase A echo graph: proves browser → Node → Python streaming, a pause for the user
(interrupt) and resume, restart survival, and error surfacing. No model calls."""
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt

from app.diagnostics.graph.state import EchoState
from app.utils.progress import progress, publish


def _maybe_explode(state: EchoState, node: str) -> None:
    if state.get("explode_at") == node:
        raise RuntimeError(f"diagnostic explosion in {node}")


async def ping_node(state: EchoState, config: RunnableConfig) -> dict:
    _maybe_explode(state, "ping")
    await progress(config, "ping", "Ping received.")
    await publish(config, "echo", {"message": state["message"]})
    return {"status": "awaiting"}


async def await_node(state: EchoState) -> dict:
    # Alone in its node: on resume LangGraph re-runs the node from the top, so nothing with a
    # side effect may sit before the interrupt.
    reply = interrupt({"kind": "echo", "message": state["message"]})
    return {"reply": str(reply)[:200]}


async def pong_node(state: EchoState, config: RunnableConfig) -> dict:
    _maybe_explode(state, "pong")
    await progress(config, "pong", "Pong.")
    await publish(config, "echo", {"message": state["message"], "reply": state.get("reply", "")})
    return {"status": "complete"}
