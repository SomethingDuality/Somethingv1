"""How facts reach memory (SO0's "every answer writes back"), as background jobs serial per scope.

  reconcile        profile/idea fields the founder set (fieldSources) → slot candidates; the
                   founder typed them, so no confirm is needed (user_direct). Events are only hints:
                   each run compares Node's documents with memory, so a lost event heals next time.
                   Free text (the idea description) is extracted when it changed (hash).
  extract_update   an update the founder posted → extracted facts
  milestone_done   a finished milestone (and its proof text) → facts
  candidates       facts handed over by another feature (the review's critic findings)

Every candidate runs through the memory_write graph (memory/graph). A candidate id is
deterministic, so a replayed job never writes a fact twice."""
import hashlib
import uuid
from datetime import datetime, timezone

from app.core import db, jobs, node_client
from app.core.checkpointer import thread_id
from app.core.errors import NotFound
from app.core.log import log
from app.core.quotes import verify
from app.core.runs import manager
from app.core.sanitize import clean, spotlight
from app.core.settings import get_settings
from app.memory import slots, store
from app.memory.decide import _equal
from app.memory.prompts.extract_prompt import MEMORY_EXTRACT_PROMPT
from app.memory.schemas import Extraction
from app.models import embeddings, llm


class MemoryWriteFailed(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _h(*parts) -> str:
    return hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:32]


def limits() -> dict:
    return {"top_k": 5, "max_judged": 3, "max_commit_attempts": 4, "gate_cosine": get_settings().memory_gate_cosine}


def founder_scope(user_id: str) -> dict:
    return {"kind": "founder", "scope_key": store.scope_key("founder", user_id), "user_id": user_id}


def idea_scope(user_id: str, idea_id: str) -> dict:
    return {"kind": "idea", "scope_key": store.scope_key("idea", idea_id), "user_id": user_id, "idea_id": idea_id}


# ---- running candidates ---------------------------------------------------------------------

async def run_candidate(scope: dict, cand: dict, *, embedding: list[float] | None = None) -> dict:
    """One candidate through the write graph, waiting until it ends or pauses for a confirm.
    `embedding`: a vector already made for this text (run_all embeds a batch in one call)."""
    done = await db.col("agent_runs").find_one({"kind": "memory_write", "candidate_id": cand["candidate_id"],
                                                "status": {"$in": ["queued", "running", "interrupted", "complete"]}})
    if done:
        return done
    run_id = uuid.uuid4().hex
    state = {"scope": scope, "candidate": cand, "limits": limits(), "commit_attempts": 0}
    if embedding is not None:
        state.update(embedding=embedding, embedding_model=embeddings.model_name(), embedded_text_key=store.text_key(cand["text"]))
    await manager.start("memory_write", thread_id=thread_id(scope["user_id"], "mem", run_id, scope.get("idea_id")),
                        user_id=scope["user_id"], idea_id=scope.get("idea_id"), run_id=run_id,
                        input=state, meta={"candidate_id": cand["candidate_id"]})
    await manager.wait(run_id)
    run = await db.col("agent_runs").find_one({"_id": run_id})
    if run["status"] == "failed":
        raise MemoryWriteFailed(f"{cand['candidate_id']}: {run.get('error', {}).get('code')}")
    return run


async def run_all(scope: dict, cands: list[dict]) -> None:
    """A batch of candidates for one scope: deduped within the batch, exact repeats of a current
    note just cite it (no run at all: ~19 Mongo operations each), and the rest are embedded in
    one call, then written one at a time (they may depend on each other)."""
    todo, seen = [], set()
    keys = store.read_keys(scope)
    for c in cands:
        key = (c.get("slot_key"), store.text_key(c["text"]))
        if key in seen:  # dedupe within the batch before searching
            continue
        seen.add(key)
        # Free facts only: a slot claim may be normalised (or dropped) by the prefilter first.
        if not c.get("slot_key") and (dup := await store.find_duplicate(keys, c["text"], None)):
            await store.cite([dup["_id"]])
            continue
        todo.append(c)
    if not todo:
        return
    vecs = await embeddings.embed([c["text"] for c in todo], ctx={"feature": "memory", "node": "embed", "user_id": scope["user_id"]})
    for c, v in zip(todo, vecs, strict=True):
        await run_candidate(scope, c, embedding=v.tolist())


# ---- building candidates ---------------------------------------------------------------------

def field_candidate(scope: dict, slot: slots.Slot, value, at: str | None, field: str) -> dict:
    head = slot.label[0].upper() + slot.label[1:]
    words = slots.describe(slot, value)
    return {
        "candidate_id": _h(scope["scope_key"], "field", field, at, words),
        "text": f"{head}: {words}.", "quote": words, "slot_key": slot.key, "value": value,
        "kind_hint": "fact", "modality": "decided", "provenance": "founder_asserted",
        "source": {"type": "profile_field", "field": field, "at": at}, "user_direct": True,
        "valid_at": at, "observed_at": at or _now(),
    }


async def extract(scope: dict, text: str, source: dict, ctx: dict) -> list[dict]:
    """Facts from founder text. Every fact must quote the text verbatim, or it is dropped."""
    body = clean(text)
    if len(body.split()) < 4:
        return []
    prompt = llm.Prompt(
        id="memory.extract", version="memory.extract.v1",
        system=MEMORY_EXTRACT_PROMPT.format(slots=slots.prompt_list(scope["kind"])),
        user=spotlight(body),
        fake_input={"text": body, "scope": scope["kind"]},
    )
    out = await llm.structured(prompt, Extraction, tier="heavy", ctx=ctx, user_text=True, max_tokens=2500)
    cands = []
    for f in out.facts:
        if not verify(f.quote, body):
            continue
        slot = slots.get(f.slot_key)
        cands.append({
            # By what the fact quotes, not its place in the list: a retry (temperature 0.7) can
            # reorder the facts, and an index would skip a new one or write a reworded one twice.
            "candidate_id": _h(scope["scope_key"], source.get("type"), source.get("ref_id"), _h(body),
                               " ".join(f.quote.lower().split()), f.slot_key or ""),
            "text": f.text.strip()[:500], "quote": f.quote.strip()[:500],
            "slot_key": slot.key if slot and slot.scope == scope["kind"] else None,
            "value": f.value if slot else None,
            "kind_hint": f.kind, "modality": f.modality, "provenance": "founder_asserted",
            "source": source, "user_direct": False, "valid_at": f.valid_at, "observed_at": source.get("at") or _now(),
        })
    return cands


def _source_at(sources: dict, field: str) -> dict | None:
    return (sources or {}).get(field.replace(".", "__"))


# ---- job handlers ---------------------------------------------------------------------------

@jobs.handler("reconcile")
async def reconcile(job: dict) -> None:
    p = job["payload"]
    try:
        ctx = await node_client.context(p["user_id"], idea_id=p.get("idea_id"), purpose="memory")
    except NotFound:
        return  # deleted since: nothing to remember
    if ctx["user"]["role"] != "Founder":
        return  # investor memory (STORE_INVESTOR) arrives with the investor orchestra
    is_idea = p["kind"] == "idea"
    scope = idea_scope(p["user_id"], p["idea_id"]) if is_idea else founder_scope(p["user_id"])
    entity = ctx["idea"] if is_idea else ctx["user"]
    fieldmap = slots.NODE_IDEA_FIELDS if is_idea else slots.NODE_USER_FIELDS
    current = {n["slot_key"]: n for n in await store.current_notes([scope["scope_key"]], embeddings=False) if n.get("slot_key")}

    cands = []
    for field, slot in fieldmap.items():
        src = _source_at(entity.get("fieldSources"), field)
        if not src or src.get("source") == "agent":
            continue  # unset, or our own write coming back
        value = slots.normalise_value(slot, entity["fields"].get(field))
        if value is None:
            continue
        note = current.get(slot.key)
        if note and (_equal(note.get("value"), value) or (note.get("source", {}).get("at") == src.get("at"))):
            continue
        cands.append(field_candidate(scope, slot, value, src.get("at"), field))

    if is_idea:
        desc = entity["fields"].get("description") or ""
        digest = _h(desc)
        sdoc = await db.col("agent_scopes").find_one({"_id": scope["scope_key"]}, {"extracted": 1}) or {}
        if desc and (sdoc.get("extracted") or {}).get("description") != digest:
            source = {"type": "idea_field", "field": "description", "ref_id": p["idea_id"], "at": str(entity.get("updatedAt") or _now())}
            cands += await extract(scope, desc, source, {"feature": "memory", "node": "extract", "user_id": p["user_id"]})
            await run_all(scope, cands)
            await db.col("agent_scopes").update_one({"_id": scope["scope_key"]}, {"$set": {"extracted.description": digest}}, upsert=True)
            return
    await run_all(scope, cands)


@jobs.handler("extract_update")
async def extract_update(job: dict) -> None:
    p = job["payload"]
    try:
        ctx = await node_client.context(p["user_id"], idea_id=p["idea_id"], purpose="memory")
    except NotFound:
        return
    update = next((u for u in ctx["idea"].get("updates", []) if u["id"] == p["update_id"]), None)
    if not update:
        return
    scope = idea_scope(p["user_id"], p["idea_id"])
    source = {"type": "idea_update", "ref_id": p["update_id"], "at": str(update.get("at"))}
    await run_all(scope, await extract(scope, update["text"], source, {"feature": "memory", "node": "extract", "user_id": p["user_id"]}))


@jobs.handler("milestone_done")
async def milestone_done(job: dict) -> None:
    p = job["payload"]
    try:
        ctx = await node_client.context(p["user_id"], idea_id=p["idea_id"], purpose="memory")
    except NotFound:
        return
    m = next((m for m in ctx["idea"].get("milestones", []) if m["id"] == p["milestone_id"]), None)
    if not m or m.get("status") != "done":
        return
    scope = idea_scope(p["user_id"], p["idea_id"])
    at = str(m.get("doneAt") or _now())
    cands = [{
        "candidate_id": _h(scope["scope_key"], "milestone", m["id"], at),
        "text": f"The founder marked the milestone “{m['title']}” as done.", "quote": m["title"],
        "slot_key": None, "value": None, "kind_hint": "fact", "modality": "decided", "provenance": "founder_asserted",
        "source": {"type": "milestone", "ref_id": m["id"], "at": at}, "user_direct": True, "valid_at": at, "observed_at": at,
    }]
    if m.get("proof"):
        cands += await extract(scope, m["proof"], {"type": "milestone_proof", "ref_id": m["id"], "at": at},
                               {"feature": "memory", "node": "extract", "user_id": p["user_id"]})
    await run_all(scope, cands)


@jobs.handler("extract_text")
async def extract_text(job: dict) -> None:
    """Founder text from elsewhere (the Something chat) → extracted facts for a saved idea."""
    p = job["payload"]
    try:
        # Still theirs (the chat checked; the idea may since be gone or never have been theirs).
        await node_client.context(p["user_id"], idea_id=p["idea_id"], purpose="memory")
    except NotFound:
        log("extract_text.skipped", reason="idea_not_theirs", idea_id=p["idea_id"])
        return
    scope = idea_scope(p["user_id"], p["idea_id"])
    await run_all(scope, await extract(scope, p["text"], p["source"], {"feature": "memory", "node": "extract", "user_id": p["user_id"]}))


@jobs.handler("candidates")
async def candidates(job: dict) -> None:
    p = job["payload"]
    await run_all(p["scope"], p["candidates"])


# ---- which events start which jobs -------------------------------------------------------------

def _reconcile_for(payload: dict, user_id: str | None, idea_id: str | None):
    if not user_id:
        return []
    if idea_id:
        return [("reconcile", store.scope_key("idea", idea_id), {"kind": "idea", "user_id": user_id, "idea_id": idea_id})]
    return [("reconcile", store.scope_key("founder", user_id), {"kind": "founder", "user_id": user_id})]


jobs.route_event("profile.updated")(lambda p, u, i: _reconcile_for(p, u, None))
jobs.route_event("idea.created")(lambda p, u, i: _reconcile_for(p, u, i))
jobs.route_event("idea.updated")(lambda p, u, i: _reconcile_for(p, u, i))
jobs.route_event("question.answered")(lambda p, u, i: _reconcile_for(p, u, p.get("entityId")))
jobs.route_event("idea.update_posted")(lambda p, u, i: [("extract_update", store.scope_key("idea", i), {"user_id": u, "idea_id": i, "update_id": p.get("updateId")})] if u and i else [])
jobs.route_event("idea.milestone_done")(lambda p, u, i: [("milestone_done", store.scope_key("idea", i), {"user_id": u, "idea_id": i, "milestone_id": p.get("milestoneId")})] if u and i else [])
