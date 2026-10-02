"""E_JUDGE, research version: a fresh-context Claude Haiku call that only classifies how NEW
relates to EXISTING (relation, modality, valid_at, quote). Code decides the operation.
Each pair is judged twice with the positions swapped; decide.combine() treats disagreement as
'unsure'. A quote that isn't really in NEW makes the judgement 'unsure' too."""
from langchain_core.runnables import RunnableConfig

from app.core.quotes import verify
from app.core.sanitize import spotlight
from app.memory.prompts.judge_prompt import MEMORY_JUDGE_INPUT, MEMORY_JUDGE_PROMPT
from app.memory.schemas import Judgement
from app.models import llm
from app.utils.ctx import llm_ctx

PROMPT_VERSION = "memory.judge.v1"


async def judge(note: dict, cand: dict, order: str, ctx: dict) -> dict:
    """One judgement of NEW (cand) against EXISTING (note), in one position order. Also used by evals."""
    existing = f"(true since {note.get('valid_at') or note.get('created_at')}) {note['text']}"
    new = f"(said on {cand.get('observed_at')}) {cand['text']}"
    a, b = ("EXISTING", existing), ("NEW", new)
    first, second = (a, b) if order == "ab" else (b, a)
    prompt = llm.Prompt(
        id="memory.judge",
        version=PROMPT_VERSION,
        system=MEMORY_JUDGE_PROMPT,
        user=MEMORY_JUDGE_INPUT.format(first_label=first[0], first=spotlight(first[1], "statement"),
                                       second_label=second[0], second=spotlight(second[1], "statement")),
        fake_input={"existing": note, "new": cand, "order": order},
    )
    j = await llm.structured(prompt, Judgement, tier="haiku", max_tokens=600, ctx=ctx)
    relation = j.relation
    if not verify(j.evidence_quote, new, min_len=2):  # the exact NEW text the model was shown
        relation = "unsure"
    return {"note_id": note.get("note_id"), "order": order, "relation": relation, "modality": j.modality,
            "valid_at": j.valid_at, "evidence_quote": j.evidence_quote, "rationale": j.rationale[:300]}


async def judge_pair_node(payload: dict, config: RunnableConfig) -> dict:
    j = await judge(payload["note"], payload["candidate"], payload["order"],
                    llm_ctx(config, "memory", "judge", payload["scope"]["user_id"]))
    return {"judgements": [j]}
