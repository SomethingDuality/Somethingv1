from langgraph.types import Send

from app.review.graph.state import ReviewState


def route_after_brief(state: ReviewState):
    return "decompose_node" if "nothing" in state["readers"] else "something_steelman_node"


def route_fanout(state: ReviewState):
    """Nothing reads the brief limits.nothing_samples times, independently and in parallel, each
    with the assumptions in a different order; Something writes its case at the same time."""
    sends = [
        Send("nothing_sample_node", {
            "sample_idx": i, "user_id": state["user_id"], "review_id": state["review_id"],
            "brief": state["brief"], "assumptions": state["assumptions"], "evidence": state.get("evidence", []),
        })
        for i in range(state["limits"]["nothing_samples"])
    ]
    if "something" in state["readers"]:
        sends.append(Send("something_steelman_node", {"user_id": state["user_id"], "review_id": state["review_id"], "brief": state["brief"]}))
    return sends


def _open_risks(state: ReviewState) -> list[str]:
    shown = [r for r in state.get("aggregate") or [] if r["severity"] in ("blocking", "important")][: state["limits"]["max_risks_shown"]]
    rs = state.get("risk_state") or {}
    return [r["assumption_id"] for r in shown if rs.get(r["assumption_id"], {}).get("status", "open") in ("open", "stands", "needs_test")]


def route_after_remember(state: ReviewState):
    return "await_reaction_node" if _open_risks(state) else "finalize_node"


def route_reaction(state: ReviewState):
    r = state.get("reaction") or {}
    kind = r.get("kind")
    if kind == "dispute" and r.get("risk_id") in _open_risks(state) and state.get("round", 0) < state["limits"]["max_rebuttal_rounds"]:
        return "rebuttal_normalise_node"
    if kind in ("accept", "dispute") and r.get("risk_id") in _open_risks(state):
        return "apply_ruling_node"  # accepted, or a dispute past the round limit (shown as disputed)
    if kind == "done":
        return "finalize_node"
    return "await_reaction_node"  # nothing actionable: wait again


def route_rebuttal_class(state: ReviewState):
    # Only new evidence or a correction can resolve a critique; argument or pressure never reaches a judge.
    kind = (state.get("rebuttal") or {}).get("kind")
    return "rebuttal_judge_node" if kind in ("new_verifiable_evidence", "factual_correction") else "apply_ruling_node"


def route_after_ruling(state: ReviewState):
    return "await_reaction_node" if _open_risks(state) else "finalize_node"
