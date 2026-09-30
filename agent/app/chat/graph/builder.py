"""The Something chat (SO0 RT_ + RT_OLDCHAT):
rules → [context → (disambiguate) → reply → remember] or a template, or "this is a new idea"."""
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from app.chat.graph.route import route_after_context, route_after_disambiguate, route_after_rules
from app.chat.graph.state import ChatState
from app.chat.nodes.context_node import context_node
from app.chat.nodes.disambiguate_node import disambiguate_node
from app.chat.nodes.remember_node import remember_node
from app.chat.nodes.reply_node import reply_node
from app.chat.nodes.route_node import route_node
from app.core.errors import NodeUnavailable, ProviderUnavailable
from app.utils.fail import fail_node

TRANSIENT = RetryPolicy(max_attempts=3, initial_interval=1.0, retry_on=(ProviderUnavailable, NodeUnavailable))


def build_chat_graph() -> StateGraph:
    graph = StateGraph(ChatState)
    graph.set_node_defaults(retry_policy=TRANSIENT, error_handler=fail_node, timeout=60)
    graph.add_node("route_node", route_node)
    graph.add_node("context_node", context_node)
    graph.add_node("disambiguate_node", disambiguate_node)
    graph.add_node("reply_node", reply_node)
    graph.add_node("remember_node", remember_node)
    graph.add_edge(START, "route_node")
    graph.add_conditional_edges("route_node", route_after_rules, ["context_node", END])
    graph.add_conditional_edges("context_node", route_after_context, ["disambiguate_node", "reply_node"])
    graph.add_conditional_edges("disambiguate_node", route_after_disambiguate, ["reply_node", END])
    graph.add_edge("reply_node", "remember_node")
    graph.add_edge("remember_node", END)
    return graph


chat_graph = build_chat_graph().compile()  # no pauses, so no checkpointer: history lives in agent_chats
