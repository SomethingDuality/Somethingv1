"""The STORE (SO0 E_STORE / STORE_INVESTOR): bi-temporal notes in agent_notes.

Four timestamps per note (research, after Zep): valid_at (became true in the world), invalid_at
(stopped being true), created_at (we learned it), expired_at (we stopped treating it as current).
A note is never edited in place: an UPDATE writes a new version in the lineage, an INVALIDATE
closes the old note and adds the new one. Every decision is one transaction guarded by the scope
version, so two writers can't both win."""
import uuid
from datetime import datetime, timezone

import numpy as np
from bson.binary import Binary, BinaryVectorDtype
from pymongo.errors import DuplicateKeyError

from app.core import db
from app.memory import slots
from app.memory.decide import when_iso
from app.memory.schemas import DECAY


class VersionConflict(Exception):
    """Someone else changed this scope between our search and our commit: search again."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def scope_key(kind: str, id_: str) -> str:
    return {"founder": "f", "idea": "i", "investor": "v"}[kind] + ":" + str(id_)


def read_keys(scope: dict) -> list[str]:
    """An idea's notes plus its founder's (founder facts are reused, not re-asked, per idea)."""
    keys = [scope["scope_key"]]
    if scope["kind"] == "idea":
        keys.append(scope_key("founder", scope["user_id"]))
    return keys


def to_binary(vec: np.ndarray) -> Binary:
    return Binary.from_vector(vec.astype(np.float32).tolist(), BinaryVectorDtype.FLOAT32)


def to_vec(b: Binary | None) -> np.ndarray:
    if b is None:
        return np.zeros(0, dtype=np.float32)
    return np.asarray(b.as_vector().data, dtype=np.float32)


async def current_notes(keys: list[str], *, embeddings: bool = True) -> list[dict]:
    projection = None if embeddings else {"embedding": 0}
    return [n async for n in db.col("agent_notes").find({"scope_key": {"$in": keys}, "status": "current"}, projection)]


async def ensure_scope(scope: dict) -> int:
    doc = await db.col("agent_scopes").find_one_and_update(
        {"_id": scope["scope_key"]},
        {"$setOnInsert": {"version": 0, "user_id": scope["user_id"], "idea_id": scope.get("idea_id"), "kind": scope["kind"], "lock": None}},
        upsert=True, return_document=True,
    )
    return int(doc.get("version", 0))


def _new_note(scope: dict, cand: dict, decision: dict, embedding: list | None, model: str, *, status: str = "current",
              lineage: str | None = None, version: int = 1, invalid_at=None) -> dict:
    slot = slots.get(cand.get("slot_key"))
    kind = "option" if decision["op"] == "ADD_OPTION" else cand.get("kind_hint", "fact")
    return {
        "_id": uuid.uuid4().hex,
        "op_id": cand["candidate_id"],
        "scope_kind": scope["kind"], "scope_key": scope["scope_key"],
        "user_id": scope["user_id"], "idea_id": scope.get("idea_id"),
        "lineage_id": lineage or uuid.uuid4().hex, "version": version,
        "slot_key": slot.key if slot else None,
        "kind": kind,
        "text": cand["text"], "value": cand.get("value"), "quote": cand.get("quote", ""),
        "source": cand.get("source", {}), "source_at": cand.get("source", {}).get("at"),
        "provenance": cand["provenance"], "confirmed_at": cand.get("confirmed_at"),
        "modality": cand.get("modality", "decided"),
        "valid_at": when_iso(cand.get("valid_at")) or when_iso(cand.get("observed_at")),
        "invalid_at": invalid_at, "created_at": _now(), "expired_at": None,
        "status": status, "links": decision.get("links", []), "flags": decision.get("flags", []),
        "embedding": to_binary(np.asarray(embedding, dtype=np.float32)) if embedding is not None else None,
        "embedding_model": model,
        "cite_count": 0, "last_cited_at": None, "decay_class": DECAY.get(kind, "slow"),
    }


async def commit(scope: dict, cand: dict, decision: dict, *, embedding: list | None, model: str,
                 expected_version: int, log: dict) -> dict:
    """Apply one decision atomically. Returns {outcome, written_note_ids}. Raises VersionConflict."""
    op = decision["op"]
    notes, scopes = db.col("agent_notes"), db.col("agent_scopes")
    result = {"outcome": "noop", "written_note_ids": []}

    async def txn(s):
        bumped = await scopes.find_one_and_update(
            {"_id": scope["scope_key"], "version": expected_version}, {"$inc": {"version": 1}}, session=s)
        if not bumped:
            raise VersionConflict(scope["scope_key"])
        targets = {}
        for tid in decision.get("target_note_ids", []):
            t = await notes.find_one({"_id": tid}, session=s)
            if not t or (op != "NOOP" and t["status"] != "current"):
                raise VersionConflict(f"target {tid} changed")
            targets[tid] = t
        now = _now()
        if op == "NOOP":
            if decision.get("rule") in ("same", "same_slot_value") and targets:
                await notes.update_many({"_id": {"$in": list(targets)}}, {"$inc": {"cite_count": 1}, "$set": {"last_cited_at": now}}, session=s)
            result.update(outcome="noop")
        elif op == "UPDATE":
            (tid, t), = targets.items()
            new = _new_note(scope, cand, decision, embedding, model, lineage=t["lineage_id"], version=t["version"] + 1)
            new["links"] = [*new["links"], {"rel": "supersedes", "note_id": tid}]
            await notes.update_one({"_id": tid}, {"$set": {"status": "superseded", "expired_at": now}}, session=s)
            await notes.insert_one(new, session=s)
            result.update(outcome="updated", written_note_ids=[new["_id"]])
        elif op == "INVALIDATE":
            (tid, t), = targets.items()
            new = _new_note(scope, cand, decision, embedding, model)
            await notes.update_one({"_id": tid}, {"$set": {"status": "invalidated", "expired_at": now, "invalid_at": new["valid_at"]}}, session=s)
            await notes.insert_one(new, session=s)
            result.update(outcome="invalidated", written_note_ids=[new["_id"]])
        else:  # ADD, ADD_OPTION, ADD_CONFLICT, ADD_HISTORICAL
            status, invalid_at = "current", None
            if op == "ADD_HISTORICAL":
                newer = next((link["note_id"] for link in decision.get("links", []) if link["rel"] == "superseded_by"), None)
                newer_doc = await notes.find_one({"_id": newer}, session=s) if newer else None
                status, invalid_at = "superseded", (newer_doc or {}).get("valid_at")
            new = _new_note(scope, cand, decision, embedding, model, status=status, invalid_at=invalid_at)
            await notes.insert_one(new, session=s)
            # Only a decided, current value is mirrored into Node's fields ("added"); an option, an
            # old value or a conflict stays in memory.
            outcome = {"ADD_CONFLICT": "conflict", "ADD_OPTION": "added_option", "ADD_HISTORICAL": "added_historical"}.get(op, "added")
            result.update(outcome=outcome, written_note_ids=[new["_id"]])
        await db.col("agent_memory_decisions").insert_one({
            **log, "scope_key": scope["scope_key"], "user_id": scope["user_id"], "idea_id": scope.get("idea_id"),
            "decision": decision, "outcome": result["outcome"], "note_ids": result["written_note_ids"], "at": now,
        }, session=s)

    try:
        async with db.client().start_session() as session:
            await session.with_transaction(txn)
    except DuplicateKeyError:
        # This candidate was committed before (a job replay): op_id is unique. Nothing to do.
        return {"outcome": "duplicate", "written_note_ids": []}
    return result


async def cite(note_ids: list[str]) -> None:
    """E_REINFORCE, research version: only when a note is cited, restated or confirmed, never
    merely because it was retrieved."""
    if note_ids:
        await db.col("agent_notes").update_many({"_id": {"$in": note_ids}}, {"$inc": {"cite_count": 1}, "$set": {"last_cited_at": _now()}})


def public(note: dict) -> dict:
    """A note without its embedding, safe to pass to prompts or tests."""
    return {k: v for k, v in note.items() if k != "embedding"}
