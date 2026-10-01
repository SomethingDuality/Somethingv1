"""Waits for the founder's answer to the confirm (days if need be: the checkpoint is in Mongo).
Nothing with a side effect may sit here: on resume LangGraph runs this node again from the top."""
from datetime import datetime, timezone

from langgraph.types import interrupt

from app.memory import slots
from app.memory.graph.state import MemoryWriteState


async def await_confirm_node(state: MemoryWriteState) -> dict:
    answer = interrupt({"kind": "confirm", "confirmId": state["confirm_id"]}) or {}
    choice = answer.get("choice")
    cand = dict(state["candidate"])
    now = datetime.now(timezone.utc).isoformat()
    if choice == "yes":
        cand.update(user_direct=True, provenance="founder_asserted", confirmed_at=now)
        return {"confirm": answer, "candidate": cand}
    if choice == "change":
        slot = slots.get(cand["slot_key"])
        value = str(answer.get("value") or "").strip()[:200]
        cand.update(
            candidate_id=f"{cand['candidate_id']}:changed",
            value=value, text=f"{slot.label[0].upper() + slot.label[1:]}: {value}", quote=value,
            user_direct=True, provenance="founder_asserted", confirmed_at=now, observed_at=now,
        )
        return {"confirm": answer, "candidate": cand}
    # Skipped or expired: memory doesn't change (the decision is still logged).
    decision = {**state["decision"], "op": "NOOP", "target_note_ids": [], "rule": f"unconfirmed_{choice or 'skip'}", "needs_confirm": False}
    return {"confirm": {"choice": choice or "skip"}, "decision": decision}
