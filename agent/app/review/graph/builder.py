"""The review graph: SO0's Critic (CR_) with the research's corrections, plus the Something reader.

load → brief → [decompose → Send(nothing_sample ×3) + Send(something_steelman)] → aggregate
     → verdict → relay → remember → await_reaction ⇄ (rebuttal_normalise → rebuttal_judge?) → apply_ruling
     → finalize
Only-Something reviews go brief → something_steelman → aggregate (a no-op) → … → finalize."""
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from app.core.errors import NodeUnavailable, ProviderUnavailable
from app.review.graph.route import (
    route_after_brief,
    route_after_remember,
    route_after_ruling,
    route_fanout,
    route_reaction,
    route_rebuttal_class,
)
from app.review.graph.state import ReviewState
from app.review.nodes.aggregate_node import aggregate_node
from app.review.nodes.apply_ruling_node import apply_ruling_node
from app.review.nodes.await_reaction_node import await_reaction_node
from app.review.nodes.brief_node import brief_node
from app.review.nodes.decompose_node import decompose_node
from app.review.nodes.finalize_node import finalize_node
from app.review.nodes.load_node import load_node
from app.review.nodes.nothing_sample_node import nothing_sample_node
from app.review.nodes.rebuttal_judge_node import rebuttal_judge_node
from app.review.nodes.rebuttal_normalise_node import rebuttal_normalise_node
from app.review.nodes.relay_node import relay_node
from app.review.nodes.remember_node import remember_node
from app.review.nodes.something_steelman_node import something_steelman_node
from app.review.nodes.verdict_node import verdict_node
from app.utils.fail import fail_node

TRANSIENT = RetryPolicy(max_attempts=3, initial_interval=1.0, retry_on=(ProviderUnavailable, NodeUnavailable))


def build_review_graph() -> StateGraph:
    graph = StateGraph(ReviewState)
    graph.set_node_defaults(retry_policy=TRANSIENT, error_handler=fail_node, timeout=240)

    for name, fn in [
        ("load_node", load_node), ("brief_node", brief_node), ("decompose_node", decompose_node),
        ("nothing_sample_node", nothing_sample_node), ("something_steelman_node", something_steelman_node),
        ("aggregate_node", aggregate_node), ("verdict_node", verdict_node), ("relay_node", relay_node),
        ("remember_node", remember_node), ("await_reaction_node", await_reaction_node),
        ("rebuttal_normalise_node", rebuttal_normalise_node), ("rebuttal_judge_node", rebuttal_judge_node),
        ("apply_ruling_node", apply_ruling_node), ("finalize_node", finalize_node),
    ]:
        graph.add_node(name, fn)

    graph.add_edge(START, "load_node")
    graph.add_edge("load_node", "brief_node")
    graph.add_conditional_edges("brief_node", route_after_brief, ["decompose_node", "something_steelman_node"])
    graph.add_conditional_edges("decompose_node", route_fanout, ["nothing_sample_node", "something_steelman_node"])
    graph.add_edge("nothing_sample_node", "aggregate_node")
    graph.add_edge("something_steelman_node", "aggregate_node")
    graph.add_edge("aggregate_node", "verdict_node")
    graph.add_edge("verdict_node", "relay_node")
    graph.add_edge("relay_node", "remember_node")
    graph.add_conditional_edges("remember_node", route_after_remember, ["await_reaction_node", "finalize_node"])
    graph.add_conditional_edges("await_reaction_node", route_reaction,
                                ["rebuttal_normalise_node", "apply_ruling_node", "finalize_node", "await_reaction_node"])
    graph.add_conditional_edges("rebuttal_normalise_node", route_rebuttal_class, ["rebuttal_judge_node", "apply_ruling_node"])
    graph.add_edge("rebuttal_judge_node", "apply_ruling_node")
    graph.add_conditional_edges("apply_ruling_node", route_after_ruling, ["await_reaction_node", "finalize_node"])
    graph.add_edge("finalize_node", END)
    return graph


def compile_review(checkpointer):
    return build_review_graph().compile(checkpointer=checkpointer)
