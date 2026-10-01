"""What Something knows when it answers: the review on screen (Nothing's words, verbatim), what it
found strong, and memory for a saved idea (founder-stated and verified facts; the critic's own
notes are already in the review). Typed-text reviews have no memory behind them."""
from langchain_core.runnables import RunnableConfig

from app.chat.graph.state import ChatState
from app.core import db
from app.memory import read, store
from app.memory.ingest import idea_scope
from app.utils.ctx import llm_ctx


async def context_node(state: ChatState, config: RunnableConfig) -> dict:
    ctx = {"idea_line": "", "verdict": "none yet", "risks": [], "strengths": [], "facts": []}
    if state.get("review_id"):
        doc = await db.col("agent_reviews").find_one({"_id": state["review_id"], "user_id": state["user_id"]}, {"view": 1})
        view = (doc or {}).get("view") or {}
        ctx["idea_line"] = ((view.get("brief") or {}).get("oneLiner")) or ""
        nothing = view.get("nothing") or {}
        if nothing:
            ctx["verdict"] = nothing["verdict"]["text"]
            ctx["risks"] = [{"id": r["id"], "title": r["title"], "test": r["test"]["text"], "criteria": r["criteria"], "status": r["status"]}
                            for r in nothing.get("risks", [])]
        ctx["strengths"] = [s["text"] for s in ((view.get("something") or {}).get("strengths") or [])]
    if state.get("idea_id"):
        scope = idea_scope(state["user_id"], state["idea_id"])
        notes = await read.recall(store.read_keys(scope), state["text"], k=8, exclude_sources=("critic", "review"),
                                  ctx=llm_ctx(config, "chat", "recall", state["user_id"]))
        ctx["facts"] = [f"{n['text']} ({'verified' if n['provenance'] == 'verified_artefact' else 'founder-stated'})"
                        for n in notes if n["provenance"] in ("verified_artefact", "founder_asserted")]
        if not ctx["idea_line"]:
            title = await read.known([scope["scope_key"]], "idea.title")
            ctx["idea_line"] = (title or {}).get("value") or ""
    return {"context": ctx}
