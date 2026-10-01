"""State for one review (SO0 Critic CR_ + the Something reader). Limits live here and route.py
enforces them (RabbitHole's lesson: a prompt asking for "2 perspectives" got 6–8)."""
import operator
from typing import Annotated, Literal, NotRequired, TypedDict

from app.review.graph.reducers import merge_by_sample_idx

Reader = Literal["something", "nothing"]


class ReviewLimits(TypedDict):
    nothing_samples: int        # 3 (R7)
    min_samples: int            # usable samples needed for a verdict
    min_agreeing_votes: int     # 2 (R2)
    max_rebuttal_rounds: int    # 2
    max_risks_shown: int        # 3
    max_minor_per_sample: int   # 2


class ReviewState(TypedDict):
    review_id: str
    user_id: str
    idea_id: NotRequired[str | None]
    subject: Literal["saved_idea", "typed_text"]
    readers: list[Reader]
    limits: ReviewLimits
    typed_text: NotRequired[str]
    raw_text: NotRequired[str]                     # what the brief is written from; never shown to Nothing
    evidence: NotRequired[list[dict]]              # e1… from memory: verified or founder-stated, never critic notes
    injection_signals: NotRequired[list[str]]
    brief: NotRequired[dict]                       # {one_liner, claims:[{id, text, quote, specific, founder_stated}], unknowns}
    assumptions: NotRequired[list[dict]]           # exactly one per category: {id, category, statement, claim_ids}
    nothing_samples: NotRequired[Annotated[list[dict], merge_by_sample_idx]]
    steelman: NotRequired[dict | None]
    aggregate: NotRequired[list[dict]]
    verdict: NotRequired[dict]
    address: NotRequired[list[dict]]
    risk_state: NotRequired[dict]                  # assumption id -> {status, ruling}
    round: int                                     # disputes judged so far; incremented only in apply_ruling_node
    reaction: NotRequired[dict]                    # the founder's last reaction (resume value)
    rebuttal: NotRequired[dict]                    # the dispute being judged: {risk_id, kind, neutral_text, ruling?}
    rebuttals: NotRequired[Annotated[list[dict], operator.add]]
    status: NotRequired[str]
    error: NotRequired[dict]
