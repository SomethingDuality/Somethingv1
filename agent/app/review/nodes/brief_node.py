"""The Idea Brief normaliser (research: sycophancy is a pipeline property). The pitch becomes a
neutral third-person brief with claims listed as claims; Nothing reads only this. A claim whose
quote isn't really in the founder's text is dropped."""
from langchain_core.runnables import RunnableConfig

from app.core.quotes import verify
from app.core.sanitize import spotlight
from app.models import llm
from app.review.graph.state import ReviewState
from app.review.prompts.brief_prompt import BRIEF_PROMPT
from app.review.schemas import IdeaBrief
from app.review.view import brief_view
from app.utils.ctx import llm_ctx
from app.utils.progress import progress, publish


async def brief_node(state: ReviewState, config: RunnableConfig) -> dict:
    await progress(config, "brief", "Writing down what the idea claims.")
    raw = state["raw_text"]
    prompt = llm.Prompt(id="review.brief", version="review.brief.v1", system=BRIEF_PROMPT, user=spotlight(raw), fake_input={"text": raw})
    out = await llm.structured(prompt, IdeaBrief, tier="heavy", user_text=True, max_tokens=3000,
                               ctx=llm_ctx(config, "review", "brief", state["user_id"], review_id=state["review_id"]))
    claims = []
    for c in out.claims:
        if verify(c.quote, raw) and len(claims) < 15:
            claims.append({"id": f"c{len(claims) + 1}", "text": c.text.strip()[:400], "quote": c.quote.strip()[:400],
                           "specific": c.specific, "founder_stated": True})
    brief = {"one_liner": out.one_liner.strip()[:400], "claims": claims, "unknowns": [u.strip()[:160] for u in out.unknowns[:6]]}
    await publish(config, "brief", brief_view(brief))
    return {"brief": brief}
