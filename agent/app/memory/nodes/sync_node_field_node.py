"""When a slot mirrors a Node field (stage, location, sectors…), the new value goes to Node through
applyUpdate with source 'agent' (one write path, provenance recorded). Values that came from that
very field aren't written back. A value Node rejects is flagged on the note, never forced."""
from datetime import datetime, timezone

from app.core import db, node_client
from app.core.log import warn
from app.memory import slots
from app.memory.graph.state import MemoryWriteState


async def sync_node_field_node(state: MemoryWriteState) -> dict:
    cand, scope = state["candidate"], state["scope"]
    slot = slots.get(cand.get("slot_key"))
    if not slot or not slot.node_field or cand.get("source", {}).get("type") == "profile_field":
        return {}
    if scope["kind"] == "idea":
        res = await node_client.apply_update(scope["user_id"], {slot.node_field: cand["value"]}, entity="idea",
                                             entity_id=scope["idea_id"], ref=cand["candidate_id"])
    else:
        res = await node_client.apply_update(scope["user_id"], {slot.node_field: cand["value"]}, ref=cand["candidate_id"])
    if res.get("ok") is False:
        warn("memory.node_sync_rejected", slot=slot.key, field=res.get("field"))
        await db.col("agent_notes").update_many({"_id": {"$in": state.get("written_note_ids") or []}},
                                                {"$addToSet": {"flags": "node_sync_rejected"}})
        return {"flags": ["node_sync_rejected"]}
    await db.col("agent_notes").update_many({"_id": {"$in": state.get("written_note_ids") or []}},
                                            {"$set": {"synced_at": datetime.now(timezone.utc)}})
    return {}
