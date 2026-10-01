"""A fresh-context Sonnet ruling on one dispute: the critique and the founder's (neutral) reply are
shown as positions A and B in random order, with the criteria Nothing set before the reply."""
import random

from langchain_core.runnables import RunnableConfig

from app.core.sanitize import spotlight
from app.models import llm
from app.review.graph.state import ReviewState
from app.review.prompts.rebuttal_prompt import REBUTTAL_JUDGE_INPUT, REBUTTAL_JUDGE_PROMPT
from app.review.schemas import Ruling
from app.utils.ctx import llm_ctx
from app.utils.progress import progress


async def rule(row: dict, reb: dict, seed: str, ctx: dict) -> dict:
    """A fresh-context ruling on one dispute → {outcome, rationale}. Also used by evals."""
    critique = f"{row['title']}. {row['rationale']}"
    pair = [("critique", critique), ("reply", reb["neutral_text"])]
    random.Random(seed).shuffle(pair)
    user = REBUTTAL_JUDGE_INPUT.format(first_label="A", first=spotlight(pair[0][1], "position"),
                                       second_label="B", second=spotlight(pair[1][1], "position"), criteria=row["criteria"])
    out = await llm.structured(
        llm.Prompt(id="review.rebuttal_judge", version="review.rebuttal.v1", system=REBUTTAL_JUDGE_PROMPT, user=user,
                   fake_input={"rebuttal": reb, "row": row}),
        Ruling, tier="sonnet", user_text=True, max_tokens=1500, effort="medium", ctx=ctx)
    return {"outcome": out.outcome, "rationale": out.rationale.strip()[:400]}


async def rebuttal_judge_node(state: ReviewState, config: RunnableConfig) -> dict:
    await progress(config, "rebuttal", "Checking whether that settles it.")
    reb = state["rebuttal"]
    row = next(r for r in state["aggregate"] if r["assumption_id"] == reb["risk_id"])
    ruling = await rule(row, reb, f"{state['review_id']}:{state.get('round', 0)}",
                        llm_ctx(config, "review", "rebuttal_judge", state["user_id"], review_id=state["review_id"]))
    return {"rebuttal": {**reb, "ruling": ruling}}
