"""Cheap checks before any model call: empty text, an exact duplicate of a current note, a slot
value that doesn't fit the slot, and a provenance the source isn't allowed to claim."""
from app.core.quotes import norm
from app.memory import slots, store
from app.memory.graph.state import MemoryWriteState

# Only a deterministic verifier may say "verified" (Phase D). Anything else claiming it is lowered.
VERIFIED_SOURCES = {"verifier"}


async def prefilter_node(state: MemoryWriteState) -> dict:
    cand = dict(state["candidate"])
    flags: list[str] = []
    if not norm(cand.get("text", "")):
        return {"outcome": "dropped", "flags": ["empty"]}

    if cand.get("provenance") == "verified_artefact" and cand.get("source", {}).get("type") not in VERIFIED_SOURCES:
        cand["provenance"] = "founder_asserted"
        flags.append("provenance_lowered")

    slot = slots.get(cand.get("slot_key"))
    if cand.get("slot_key") and not slot:
        cand["slot_key"], cand["value"] = None, None
        flags.append("unknown_slot")
    elif slot:
        value = slots.normalise_value(slot, cand.get("value"))
        if value is None:
            cand["slot_key"], cand["value"] = None, None  # keep the fact, drop the slot claim
            flags.append("slot_value_rejected")
        else:
            cand["value"] = value

    dup = await store.find_duplicate(store.read_keys(state["scope"]), cand["text"], cand.get("slot_key"))
    if dup:
        await store.cite([dup["_id"]])  # the founder said it again: that's a restatement
        return {"outcome": "noop", "candidate": cand, "flags": [*flags, "exact_duplicate"]}
    return {"candidate": cand, "flags": flags}
