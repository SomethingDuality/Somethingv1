"""When a slot mirrors a Node field (stage, location, sectors…), the new value goes to Node through
applyUpdate with source 'agent' (one write path, provenance recorded). Values that came from that
very field aren't written back. A value Node rejects is flagged on the note, never forced.
If Node can't be reached, the sync becomes its own job (retried with backoff): the note is
already committed, so re-running this write would only find it as a duplicate."""
from datetime import datetime, timezone

from app.core import db, jobs, node_client
from app.core.errors import AgentError
from app.core.log import warn
from app.memory import slots
from app.memory.graph.state import MemoryWriteState


async def sync(user_id: str, scope: dict, slot: slots.Slot, value, ref: str, note_ids: list[str]) -> dict:
    if scope["kind"] == "idea":
        res = await node_client.apply_update(user_id, {slot.node_field: value}, entity="idea", entity_id=scope["idea_id"], ref=ref)
    else:
        res = await node_client.apply_update(user_id, {slot.node_field: value}, ref=ref)
    if res.get("ok") is False:
        warn("memory.node_sync_rejected", slot=slot.key, field=res.get("field"))
        await db.col("agent_notes").update_many({"_id": {"$in": note_ids}}, {"$addToSet": {"flags": "node_sync_rejected"}})
        return {"flags": ["node_sync_rejected"]}
    await db.col("agent_notes").update_many({"_id": {"$in": note_ids}}, {"$set": {"synced_at": datetime.now(timezone.utc)}})
    return {}


async def sync_node_field_node(state: MemoryWriteState) -> dict:
    cand, scope = state["candidate"], state["scope"]
    slot = slots.get(cand.get("slot_key"))
    if not slot or not slot.node_field or cand.get("source", {}).get("type") == "profile_field":
        return {}
    note_ids = state.get("written_note_ids") or []
    try:
        return await sync(scope["user_id"], scope, slot, cand["value"], cand["candidate_id"], note_ids)
    except AgentError as e:
        warn("memory.node_sync_deferred", slot=slot.key, code=e.code)
        await jobs.enqueue("node_sync", scope["scope_key"], user_id=scope["user_id"], idea_id=scope.get("idea_id"), payload={
            "scope": scope, "slot_key": slot.key, "value": cand["value"], "ref": cand["candidate_id"], "note_ids": note_ids,
        }, dedupe_key=f"sync:{cand['candidate_id']}", delay_s=5)
        return {"flags": ["node_sync_deferred"]}


@jobs.handler("node_sync")
async def node_sync_job(job: dict) -> None:
    p = job["payload"]
    # Only a value that is still current goes to Node (a later change may have replaced it).
    if not await db.col("agent_notes").count_documents({"_id": {"$in": p["note_ids"]}, "status": "current"}):
        return
    await sync(p["scope"]["user_id"], p["scope"], slots.get(p["slot_key"]), p["value"], p["ref"], p["note_ids"])
