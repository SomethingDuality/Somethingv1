"""Compact facts from the review go to memory as a background job (not on the review's path):
the risks Nothing raised, as agent_inferred report facts. They never feed a later Nothing (load
excludes critic notes) and can never overwrite anything the founder or a verifier stated.
Typed-text reviews leave nothing in memory."""
import hashlib
from datetime import datetime, timezone

from app.core import jobs
from app.memory.ingest import idea_scope
from app.review import store
from app.review.graph.route import _open_risks
from app.review.graph.state import ReviewState


async def remember_node(state: ReviewState) -> dict:
    rows = [r for r in state.get("aggregate") or [] if r["severity"] in ("blocking", "important")]
    if state["subject"] == "saved_idea" and rows:
        scope = idea_scope(state["user_id"], state["idea_id"])
        cands = [{
            "candidate_id": hashlib.sha256(f"{state['review_id']}|{r['assumption_id']}".encode()).hexdigest()[:32],
            "text": f"A review flagged a risk: {r['title']}.", "quote": r["title"], "slot_key": None, "value": None,
            "kind_hint": "report_fact", "modality": "decided", "provenance": "agent_inferred",
            "source": {"type": "critic", "ref_id": state["review_id"]}, "user_direct": False,
            "observed_at": datetime.now(timezone.utc).isoformat(),
        } for r in rows]
        await jobs.enqueue("candidates", scope["scope_key"], user_id=state["user_id"], idea_id=state["idea_id"],
                           payload={"scope": scope, "candidates": cands}, dedupe_key=f"review-remember:{state['review_id']}")
    # "Waiting for you" only when the graph will actually pause (the same test as the route);
    # otherwise it goes on to finalize and a reaction would be refused.
    waits = bool(_open_risks(state))
    await store.save(state, status="awaiting_reaction" if waits else "running")
    return {"status": "awaiting_reaction" if waits else state.get("status", "running")}
