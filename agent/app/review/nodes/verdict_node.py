"""CR_VERDICT as code (R1/R2): the label is computed, never chosen by a model. Nothing's reader
block goes out here, with the risks verbatim."""
from langchain_core.runnables import RunnableConfig

from app.review import store
from app.review.graph.state import ReviewState
from app.review.verdict import verdict
from app.review.view import nothing_view
from app.utils.progress import progress, publish


async def verdict_node(state: ReviewState, config: RunnableConfig) -> dict:
    if "nothing" not in state["readers"]:
        return {}
    await progress(config, "verdict", "Putting the three reviews together.")
    verified = sum(1 for e in state.get("evidence", []) if e["kind"] == "verified")
    v = verdict(state["aggregate"], min_agreeing=state["limits"]["min_agreeing_votes"], verified_count=verified)
    risk_state = {}
    await publish(config, "reader", {"reader": "nothing", **nothing_view(state["aggregate"], v, state["brief"], risk_state, state["limits"]["max_risks_shown"])})
    await store.save({**state, "verdict": v, "risk_state": risk_state})
    return {"verdict": v, "risk_state": risk_state}
