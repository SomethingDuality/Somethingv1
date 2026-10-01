from app.review import store
from app.review.graph.state import ReviewState


async def finalize_node(state: ReviewState) -> dict:
    disputed = any(v.get("status") == "disputed" for v in (state.get("risk_state") or {}).values())
    status = "disputed" if disputed else "complete"
    await store.save(state, status="complete", extra={"outcome": status})
    return {"status": "complete"}
