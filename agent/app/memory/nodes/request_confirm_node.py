"""R12: before memory changes a high-stakes fact (country, legal entity, stage, funding, pricing)
the founder confirms it with one tap in the Something box: "Stage: Prototype → MVP, right?"

This node has the side effects (the pending-confirm row, the question in Node); await_confirm_node
holds only the pause, because LangGraph re-runs a node from its top when it resumes."""
import hashlib
from datetime import datetime, timedelta, timezone

from langchain_core.runnables import RunnableConfig

from app.core import db, node_client
from app.core.settings import get_settings
from app.memory import slots
from app.memory.graph.state import MemoryWriteState


def confirm_id_for(candidate_id: str) -> str:
    return "c" + hashlib.sha256(candidate_id.encode()).hexdigest()[:23]


def confirm_prompt(slot: slots.Slot, current, proposed, idea_title: str | None) -> str:
    where = f" for “{idea_title}”" if idea_title else ""
    head = slot.label[0].upper() + slot.label[1:]
    if current is None or current == [] or current == "":
        return f"{head}{where}: {slots.describe(slot, proposed)}, right?"
    return f"{head}{where}: {slots.describe(slot, current)} → {slots.describe(slot, proposed)}, right?"


async def request_confirm_node(state: MemoryWriteState, config: RunnableConfig) -> dict:
    scope, cand = state["scope"], state["candidate"]
    slot = slots.get(cand["slot_key"])
    current = next((n.get("value") for n in state.get("neighbours") or [] if n.get("same_slot")), None)
    confirm_id = confirm_id_for(cand["candidate_id"])
    expires = datetime.now(timezone.utc) + timedelta(days=get_settings().confirm_ttl_days)
    run_id = ((config or {}).get("configurable") or {}).get("run_id")
    idea_title = None
    if scope["kind"] == "idea":
        ctx = await node_client.context(scope["user_id"], idea_id=scope["idea_id"], purpose="memory")
        idea_title = (ctx.get("idea") or {}).get("fields", {}).get("title")
    prompt = confirm_prompt(slot, current, cand.get("value"), idea_title)
    # run_id is always the current run's: a job retried after a failed run asks again from a new run,
    # and the founder's answer must resume that one, not the dead one.
    await db.col("agent_pending_confirms").update_one(
        {"_id": confirm_id},
        {"$set": {"run_id": run_id},
         "$setOnInsert": {
            "user_id": scope["user_id"], "idea_id": scope.get("idea_id"), "scope_key": scope["scope_key"],
            "slot_key": slot.key, "old_value": current, "new_value": cand.get("value"), "prompt": prompt,
            "status": "open", "expires_at": expires, "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    await node_client.put_question(confirm_id, {
        "userId": scope["user_id"], "ideaId": scope.get("idea_id"), "prompt": prompt, "slot": slot.key,
        "slotLabel": slot.label, "current": slots.describe(slot, current) if current is not None else None,
        "proposed": slots.describe(slot, cand.get("value")), "expiresAt": expires.isoformat(),
    })
    return {"confirm_id": confirm_id}
