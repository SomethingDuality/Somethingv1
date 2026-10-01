"""CR_DECOMPOSE: one assumption per category. Code enforces exactly six (a model asked for six
may return five or eight), drops claim ids that don't exist, and fills a missing category with an
honest 'not stated' assumption so Nothing can say there was too little to judge."""
from langchain_core.runnables import RunnableConfig

from app.models import llm
from app.review.categories import CATEGORIES
from app.review.graph.state import ReviewState
from app.review.prompts.brief_prompt import DECOMPOSE_PROMPT
from app.review.schemas import Decomposition
from app.utils.ctx import llm_ctx
from app.utils.progress import progress


def _brief_text(brief: dict) -> str:
    lines = [brief["one_liner"], ""] + [f"{c['id']}: {c['text']}" for c in brief["claims"]]
    return "\n".join(lines)


async def decompose_node(state: ReviewState, config: RunnableConfig) -> dict:
    await progress(config, "assumptions", "Listing what has to be true for it to work.")
    brief = state["brief"]
    cats = "\n".join(f"- {c.id}: {c.question}" for c in CATEGORIES)
    prompt = llm.Prompt(id="review.decompose", version="review.decompose.v1", system=DECOMPOSE_PROMPT.format(categories=cats),
                        user=_brief_text(brief), fake_input={"brief": brief})
    out = await llm.structured(prompt, Decomposition, tier="heavy", user_text=True, max_tokens=2000,
                               ctx=llm_ctx(config, "review", "decompose", state["user_id"], review_id=state["review_id"]))
    claim_ids = {c["id"] for c in brief["claims"]}
    by_cat = {}
    for a in out.assumptions:
        by_cat.setdefault(a.category, a)
    assumptions = []
    for i, c in enumerate(CATEGORIES, 1):
        a = by_cat.get(c.id)
        assumptions.append({
            "id": f"a{i}", "category": c.id,
            "statement": a.statement.strip()[:300] if a else f"Not stated: {c.question.lower()}.",
            "claim_ids": [x for x in (a.claim_ids if a else []) if x in claim_ids],
        })
    return {"assumptions": assumptions}
