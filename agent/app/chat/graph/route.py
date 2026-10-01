from langgraph.graph import END

from app.chat.graph.state import ChatState


def route_after_rules(state: ChatState):
    kind = state.get("kind")
    if kind in ("about_this", "unsure"):
        return "context_node"
    return END  # general / judge_request carry a template reply; new_idea goes to a review


def route_after_context(state: ChatState):
    return "disambiguate_node" if state.get("kind") == "unsure" else "reply_node"


def route_after_disambiguate(state: ChatState):
    return "reply_node" if state.get("kind") == "about_this" else END
