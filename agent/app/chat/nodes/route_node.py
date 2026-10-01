"""RT_CLASSIFY, rules only (no model call for greetings, judge requests, questions or pitches)."""
from app.chat.graph.state import ChatState
from app.router.classify import classify_turn


async def route_node(state: ChatState) -> dict:
    out = classify_turn(state["text"], has_context=bool(state.get("review_id") or state.get("idea_id")))
    return {"kind": out["kind"], **({"reply": out["reply"]} if out.get("reply") else {})}
