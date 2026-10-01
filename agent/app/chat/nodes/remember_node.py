"""RT_OLDCHAT → E_CAND: what a founder states in the chat about a saved idea goes to memory as a
background job (extraction with verbatim quotes; high-stakes changes still need a confirm, R12).
Questions aren't facts, and typed-text reviews have no memory behind them."""
import hashlib
from datetime import datetime, timezone

from app.chat.graph.state import ChatState
from app.core import jobs
from app.memory.ingest import idea_scope
from app.router.classify import _QUESTION


async def remember_node(state: ChatState) -> dict:
    text = state["text"].strip()
    if state.get("idea_id") and not _QUESTION.search(text) and len(text.split()) >= 4:
        scope = idea_scope(state["user_id"], state["idea_id"])
        ref = hashlib.sha256(f"{state['user_id']}|{text}".encode()).hexdigest()[:24]
        await jobs.enqueue("extract_text", scope["scope_key"], user_id=state["user_id"], idea_id=state["idea_id"], payload={
            "user_id": state["user_id"], "idea_id": state["idea_id"], "text": text,
            "source": {"type": "chat", "ref_id": ref, "at": datetime.now(timezone.utc).isoformat()},
        }, dedupe_key=f"chat:{ref}")
    return {}
