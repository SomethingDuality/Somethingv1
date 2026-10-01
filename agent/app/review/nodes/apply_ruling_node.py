"""Applies a reaction or a ruling to one risk, and is the only place `round` goes up (one dispute
judged = one round; RabbitHole advanced its counter in the wrong node). After max rounds a risk
is shown as disputed, as it is. A rebuttal goes to memory as founder_asserted, never able to
overwrite verified evidence."""
import hashlib
from datetime import datetime, timezone

from langchain_core.runnables import RunnableConfig

from app.core import jobs
from app.memory.ingest import idea_scope
from app.review import store
from app.review.graph.state import ReviewState
from app.review.relay_templates import STATUS_TEXT
from app.utils.progress import publish


async def apply_ruling_node(state: ReviewState, config: RunnableConfig) -> dict:
    reaction = state["reaction"]
    risk_id = reaction["risk_id"]
    rs = dict(state.get("risk_state") or {})
    rnd = state.get("round", 0)
    rebuttals: list[dict] = []
    if reaction["kind"] == "accept":
        rs[risk_id] = {"status": "accepted", "ruling": None}
    elif rnd >= state["limits"]["max_rebuttal_rounds"]:
        rs[risk_id] = {"status": "disputed", "ruling": None}
    else:
        reb = state.get("rebuttal") or {}
        outcome = (reb.get("ruling") or {}).get("outcome") or "stands"  # argument or pressure: no judge, it stands
        rs[risk_id] = {"status": outcome, "ruling": (reb.get("ruling") or {}).get("rationale")}
        rnd += 1
        rebuttals.append({**reb, "round": rnd, "at": datetime.now(timezone.utc).isoformat()})
        if state["subject"] == "saved_idea" and reb.get("text"):
            scope = idea_scope(state["user_id"], state["idea_id"])
            cid = hashlib.sha256(f"{state['review_id']}|rebuttal|{rnd}".encode()).hexdigest()[:32]
            await jobs.enqueue("candidates", scope["scope_key"], user_id=state["user_id"], idea_id=state["idea_id"], payload={
                "scope": scope, "candidates": [{
                    "candidate_id": cid, "text": reb["neutral_text"][:500], "quote": reb["text"][:500], "slot_key": None, "value": None,
                    "kind_hint": "fact", "modality": "decided", "provenance": "founder_asserted",
                    "source": {"type": "rebuttal", "ref_id": state["review_id"]}, "user_direct": True,
                    "observed_at": datetime.now(timezone.utc).isoformat(),
                }]}, dedupe_key=f"rebuttal:{cid}")
    await publish(config, "ruling", {"riskId": risk_id, "status": rs[risk_id]["status"], "statusText": STATUS_TEXT.get(rs[risk_id]["status"], ""),
                                     "ruling": rs[risk_id]["ruling"], "round": rnd})
    new = {"risk_state": rs, "round": rnd, "rebuttal": {}}
    await store.save({**state, **new, "rebuttals": [*(state.get("rebuttals") or []), *rebuttals]}, status="awaiting_reaction")
    return {**new, "rebuttals": rebuttals}
