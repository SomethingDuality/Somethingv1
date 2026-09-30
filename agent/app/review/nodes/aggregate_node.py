from app.review.aggregate import aggregate
from app.review.graph.state import ReviewState


async def aggregate_node(state: ReviewState) -> dict:
    """Join point after the parallel readers. With Nothing selected, combine its samples in code."""
    if "nothing" not in state["readers"]:
        return {}
    brief = state["brief"]
    valid = {c["id"] for c in brief["claims"]} | {e["id"] for e in state.get("evidence", [])}
    lim = state["limits"]
    rows = aggregate(state.get("nothing_samples") or [], state["assumptions"], valid,
                     min_samples=lim["min_samples"], max_minor=lim["max_minor_per_sample"])
    return {"aggregate": rows}
