from langgraph.graph import END, START, StateGraph

from app.diagnostics.graph.state import EchoState
from app.diagnostics.nodes.echo_nodes import await_node, ping_node, pong_node
from app.utils.fail import fail_node


def build_echo_graph() -> StateGraph:
    graph = StateGraph(EchoState)
    graph.set_node_defaults(error_handler=fail_node, timeout=30)
    graph.add_node("ping_node", ping_node)
    graph.add_node("await_node", await_node)
    graph.add_node("pong_node", pong_node)
    graph.add_edge(START, "ping_node")
    graph.add_edge("ping_node", "await_node")
    graph.add_edge("await_node", "pong_node")
    graph.add_edge("pong_node", END)
    return graph


def compile_echo(checkpointer):
    return build_echo_graph().compile(checkpointer=checkpointer)
