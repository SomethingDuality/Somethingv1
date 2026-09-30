"""The founder reacts to Nothing's risks: "That's fair", "I disagree" (with a reply), or done.
The run waits here for as long as it takes (the checkpoint is in Mongo). Only the pause and the
validated answer live in this node: it re-runs from the top on resume."""
from langgraph.types import interrupt

from app.review.graph.route import _open_risks
from app.review.graph.state import ReviewState


async def await_reaction_node(state: ReviewState) -> dict:
    answer = interrupt({"kind": "reaction", "round": state.get("round", 0), "maxRounds": state["limits"]["max_rebuttal_rounds"],
                        "riskIds": _open_risks(state)}) or {}
    kind = answer.get("kind") if answer.get("kind") in ("accept", "dispute", "done") else "invalid"
    text = str(answer.get("text") or "").strip()[:1500]
    return {"reaction": {"kind": kind, "risk_id": answer.get("risk_id"), "text": text}}
