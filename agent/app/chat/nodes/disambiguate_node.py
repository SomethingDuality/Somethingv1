"""RT_UNSURE: a mid-length statement that could be about the idea on screen or a new pitch. The LITE
chain decides, with the idea's line from context; any failure means about_this."""
from langchain_core.runnables import RunnableConfig

from app.chat.graph.state import ChatState
from app.router.classify import refine
from app.utils.ctx import llm_ctx


async def disambiguate_node(state: ChatState, config: RunnableConfig) -> dict:
    kind = await refine(state["text"], (state.get("context") or {}).get("idea_line", ""), llm_ctx(config, "chat", "route", state["user_id"]))
    return {"kind": kind}
