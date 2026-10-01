from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from app.core.errors import NodeUnavailable, ProviderUnavailable
from app.memory.graph.route import route_commit, route_confirm, route_decision, route_gate, route_prefilter
from app.memory.graph.state import MemoryWriteState
from app.memory.nodes.await_confirm_node import await_confirm_node
from app.memory.nodes.commit_node import commit_node
from app.memory.nodes.decide_node import decide_node
from app.memory.nodes.embed_node import embed_node
from app.memory.nodes.judge_pair_node import judge_pair_node
from app.memory.nodes.prefilter_node import prefilter_node
from app.memory.nodes.request_confirm_node import request_confirm_node
from app.memory.nodes.search_node import search_node
from app.memory.nodes.sync_node_field_node import sync_node_field_node
from app.utils.fail import fail_node

# Transient failures (rate limits, an unreachable provider or Node) are retried in place.
TRANSIENT = RetryPolicy(max_attempts=3, initial_interval=1.0, retry_on=(ProviderUnavailable, NodeUnavailable))


def build_memory_write_graph() -> StateGraph:
    graph = StateGraph(MemoryWriteState)
    graph.set_node_defaults(retry_policy=TRANSIENT, error_handler=fail_node, timeout=90)

    graph.add_node("prefilter_node", prefilter_node)
    graph.add_node("embed_node", embed_node)
    graph.add_node("search_node", search_node)
    graph.add_node("judge_pair_node", judge_pair_node)
    graph.add_node("decide_node", decide_node)
    graph.add_node("request_confirm_node", request_confirm_node)
    graph.add_node("await_confirm_node", await_confirm_node)
    graph.add_node("commit_node", commit_node)
    graph.add_node("sync_node_field_node", sync_node_field_node)

    graph.add_edge(START, "prefilter_node")
    graph.add_conditional_edges("prefilter_node", route_prefilter, ["embed_node", END])
    graph.add_edge("embed_node", "search_node")
    graph.add_conditional_edges("search_node", route_gate, ["judge_pair_node", "decide_node"])
    graph.add_edge("judge_pair_node", "decide_node")
    graph.add_conditional_edges("decide_node", route_decision, ["request_confirm_node", "commit_node"])
    graph.add_edge("request_confirm_node", "await_confirm_node")
    graph.add_conditional_edges("await_confirm_node", route_confirm, ["prefilter_node", "commit_node"])
    graph.add_conditional_edges("commit_node", route_commit, ["search_node", "sync_node_field_node", END])
    graph.add_edge("sync_node_field_node", END)
    return graph


def compile_memory_write(checkpointer):
    return build_memory_write_graph().compile(checkpointer=checkpointer)
