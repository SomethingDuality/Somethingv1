"""CB_MERGE: what the review reads. For a saved idea, Node's context (pedigree already stripped,
R10) plus evidence from memory: verified artefacts and what the founder said earlier. Critic and
review notes are excluded, so Nothing is never anchored on its own past verdicts (research:
prior scores blocked 48% of corrections). Typed text is read as it is and never stored in memory."""
from langchain_core.runnables import RunnableConfig

from app.core import node_client
from app.core.sanitize import clean, signals
from app.memory import read, store
from app.memory.ingest import idea_scope
from app.review.graph.state import ReviewState
from app.utils.ctx import llm_ctx
from app.utils.progress import progress

EXCLUDED_SOURCES = ("critic", "review", "rebuttal")


def _idea_text(ctx: dict) -> str:
    idea = ctx["idea"]
    f = idea["fields"]
    parts = [f"Title: {f.get('title', '')}", f.get("description", "")]
    if f.get("stage"):
        parts.append(f"Stage: {f['stage']}")
    if f.get("tags"):
        parts.append(f"Sectors: {', '.join(f['tags'])}")
    if f.get("raising"):
        parts.append(f"Raising: {f['raising']}")
    done = [m for m in idea.get("milestones", []) if m.get("status") == "done"]
    if done:
        parts.append("Milestones done: " + "; ".join(f"{m['title']}{' (' + m['proof'] + ')' if m.get('proof') else ''}" for m in done))
    if idea.get("updates"):
        parts.append("Updates: " + " / ".join(u["text"] for u in idea["updates"][:5]))
    if idea.get("attachments"):
        parts.append("Files attached: " + ", ".join(a["name"] for a in idea["attachments"][:5]))
    return "\n".join(p for p in parts if p)


async def load_node(state: ReviewState, config: RunnableConfig) -> dict:
    await progress(config, "reading", "Reading your idea.")
    if state["subject"] == "typed_text":
        raw = state.get("typed_text", "")
        return {"raw_text": clean(raw, 2000), "evidence": [], "injection_signals": signals(raw)}
    ctx = await node_client.context(state["user_id"], idea_id=state["idea_id"], purpose="review")
    raw = _idea_text(ctx)
    scope = idea_scope(state["user_id"], state["idea_id"])
    notes = await read.recall(store.read_keys(scope), raw[:600], k=12, exclude_sources=EXCLUDED_SOURCES,
                              ctx=llm_ctx(config, "review", "load", state["user_id"], review_id=state["review_id"]))
    evidence = [
        {"id": f"e{i}", "note_id": n["_id"], "text": n["text"],
         "kind": "verified" if n["provenance"] == "verified_artefact" else "founder-stated"}
        for i, n in enumerate((n for n in notes if n["provenance"] in ("verified_artefact", "founder_asserted")), 1)
    ]
    return {"raw_text": clean(raw, 6000), "evidence": evidence, "injection_signals": signals(raw)}
