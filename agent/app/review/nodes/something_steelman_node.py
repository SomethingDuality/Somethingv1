"""Something's case for the idea (research: Something never judges; it writes the steelman in a
separate call on the brief, conceding its weakest points). Claim ids that don't exist are dropped.
If it fails, the review goes on without it rather than failing."""
from langchain_core.runnables import RunnableConfig

from app.core.errors import AgentError
from app.core.log import warn
from app.models import llm
from app.review.prompts.something_prompt import STEELMAN_PROMPT
from app.review.schemas import Steelman
from app.utils.ctx import llm_ctx
from app.utils.progress import progress


async def something_steelman_node(payload: dict, config: RunnableConfig) -> dict:
    await progress(config, "something", "Something is looking for why it could work.")
    brief = payload["brief"]
    user = brief["one_liner"] + "\n\n" + ("\n".join(f"{c['id']}: {c['text']}" for c in brief["claims"]) or "(no claims)")
    prompt = llm.Prompt(id="review.steelman", version="review.steelman.v1", system=STEELMAN_PROMPT, user=user, fake_input={"brief": brief})
    try:
        out = await llm.structured(prompt, Steelman, tier="heavy_even", user_text=True, max_tokens=1500,
                                   ctx=llm_ctx(config, "review", "steelman", payload["user_id"], review_id=payload["review_id"]))
    except AgentError as e:
        warn("review.steelman_failed", review=payload["review_id"], code=e.code)
        return {"steelman": None}
    ids = {c["id"] for c in brief["claims"]}
    return {"steelman": {
        "strengths": [{"text": s.text.strip()[:300], "claim_ids": [x for x in s.claim_ids if x in ids]} for s in out.strengths[:4]],
        "concessions": [c.strip()[:300] for c in out.concessions[:2]],
        "next_proof": out.next_proof.strip()[:300],
    }}
