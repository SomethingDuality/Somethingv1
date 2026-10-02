"""One of three independent Nothing reviews (R7: Sonnet, samples aggregated in code). Fresh context:
only the brief, the evidence on record and the assumptions, in an order shuffled per sample to
reduce position bias. The rubric and anchors are a cached prefix; the idea comes after it.
A sample that fails is recorded as failed; aggregate needs at least two usable ones. A sample
retries an outage once itself (the graph's retry would fail the whole review instead), and each
attempt is time-boxed inside the node's 240 s, so a slow sample fails alone."""
import asyncio
import json
import random
from functools import lru_cache
from pathlib import Path

from langchain_core.runnables import RunnableConfig

from app.core.errors import AgentError, ProviderUnavailable
from app.core.log import warn
from app.models import llm
from app.review.categories import BY_ID
from app.review.prompts.nothing_prompt import NOTHING_INPUT, NOTHING_RUBRIC
from app.review.schemas import CritiqueSample
from app.utils.ctx import llm_ctx
from app.utils.progress import progress

ANCHORS = Path(__file__).resolve().parents[1] / "anchors" / "anchors_v1.json"
ATTEMPTS = 2
ATTEMPT_TIMEOUT = 110.0  # two attempts and a pause fit inside the node's 240 s


@lru_cache
def rubric() -> str:
    examples = json.loads(ANCHORS.read_text())["examples"]
    anchors = "\n".join(f"- {e['idea']}\n  {json.dumps(e['assessment'], ensure_ascii=False)}" for e in examples)
    return NOTHING_RUBRIC.format(anchors=anchors)


async def nothing_sample_node(payload: dict, config: RunnableConfig) -> dict:
    i = payload["sample_idx"]
    await progress(config, "nothing", "Nothing is reading it." if i == 0 else f"Nothing is reading it again ({i + 1} of 3).")
    brief, assumptions = payload["brief"], list(payload["assumptions"])
    random.Random(f"{payload['review_id']}:{i}").shuffle(assumptions)
    evidence = payload.get("evidence") or []
    user = NOTHING_INPUT.format(
        one_liner=brief["one_liner"],
        claims="\n".join(f"{c['id']}: {c['text']}" for c in brief["claims"]) or "(none)",
        evidence="\n".join(f"{e['id']} ({e['kind']}): {e['text']}" for e in evidence) or "(none)",
        assumptions="\n".join(f"{a['id']} [{BY_ID[a['category']].label}]: {a['statement']}" for a in assumptions),
    )
    prompt = llm.Prompt(id="review.nothing", version="review.nothing.v1", system=rubric(), user=user,
                        fake_input={"brief": brief, "assumptions": assumptions, "evidence": evidence, "sample_idx": i})
    ctx = llm_ctx(config, "review", "nothing", payload["user_id"], review_id=payload["review_id"])
    for attempt in range(ATTEMPTS):
        try:
            out = await asyncio.wait_for(llm.structured(prompt, CritiqueSample, tier="sonnet", user_text=True, max_tokens=8000,
                                                        effort="medium", ctx=ctx), ATTEMPT_TIMEOUT)
            return {"nothing_samples": [{"sample_idx": i, "assessments": [a.model_dump() for a in out.assessments]}]}
        except ProviderUnavailable as e:
            if attempt + 1 < ATTEMPTS:
                await asyncio.sleep(2.0)
                continue
            code = e.code
        except AgentError as e:
            code = e.code
        except Exception as e:  # noqa: BLE001 - a timeout or a bug fails this sample, not the review
            code = "timeout" if isinstance(e, TimeoutError) else "internal"
        warn("review.sample_failed", review=payload["review_id"], sample=i, code=code, attempt=attempt + 1)
        return {"nothing_samples": [{"sample_idx": i, "failed": True, "code": code}]}
    return {"nothing_samples": [{"sample_idx": i, "failed": True, "code": "internal"}]}
