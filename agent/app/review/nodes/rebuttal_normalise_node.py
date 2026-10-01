"""A founder's disagreement, rewritten neutrally and classified before anyone judges it (research:
the rebuttal loop). Argument without evidence and pressure never reach a judge: the critique
stands until there's evidence. If the classifier fails, the reply is treated as argument."""
from langchain_core.runnables import RunnableConfig

from app.core.errors import AgentError
from app.core.log import warn
from app.core.sanitize import clean, signals, spotlight
from app.models import llm
from app.review.graph.state import ReviewState
from app.review.prompts.rebuttal_prompt import REBUTTAL_NORMALISE_PROMPT
from app.review.schemas import RebuttalClass
from app.utils.ctx import llm_ctx
from app.utils.progress import progress


async def classify(row: dict, raw_text: str, ctx: dict) -> dict:
    """A reply to one critique → {kind, neutral_text, text, signals}. Also used by evals."""
    text = clean(raw_text, 1500)
    critique = f"Title: {row['title']}\nWhy: {row['rationale']}\nWhat would settle it: {row['criteria']}"
    kind, neutral = "argument_without_evidence", text
    if text:
        try:
            out = await llm.structured(
                llm.Prompt(id="review.rebuttal_normalise", version="review.rebuttal.v1", system=REBUTTAL_NORMALISE_PROMPT,
                           user=f"Critique:\n{critique}\n\nFounder's reply:\n{spotlight(text)}", fake_input={"text": text, "row": row}),
                RebuttalClass, tier="heavy", user_text=True, max_tokens=800, ctx=ctx)
            kind, neutral = out.kind, out.neutral_text.strip()[:1500]
        except AgentError as e:
            warn("review.rebuttal_normalise_failed", review=ctx.get("review_id"), code=e.code)
    flags = signals(raw_text)
    if flags:
        kind = "pressure"  # an attempt to instruct the judge is never judged
    return {"kind": kind, "neutral_text": neutral, "text": text, "signals": flags}


async def rebuttal_normalise_node(state: ReviewState, config: RunnableConfig) -> dict:
    await progress(config, "rebuttal", "Reading your reply.")
    reaction = state["reaction"]
    row = next(r for r in state["aggregate"] if r["assumption_id"] == reaction["risk_id"])
    out = await classify(row, reaction.get("text", ""),
                         llm_ctx(config, "review", "rebuttal_normalise", state["user_id"], review_id=state["review_id"]))
    return {"rebuttal": {"risk_id": reaction["risk_id"], **out}}
