"""State for one memory write (SO0: E_CAND → E_EMBED → E_ANN → E_GATE → E_JUDGE → E_DECIDE → E_TXN).
Limits live here, not in prompts (RabbitHole's lesson); route.py enforces them."""
import operator
from typing import Annotated, Literal, NotRequired, TypedDict

from app.memory.graph.reducers import merge_judgements


class Scope(TypedDict):
    kind: Literal["founder", "idea", "investor"]
    scope_key: str           # f:<userId> | i:<ideaId> | v:<investorId>
    user_id: str
    idea_id: NotRequired[str]


class Candidate(TypedDict):
    candidate_id: str        # idempotency key: becomes note.op_id (unique)
    text: str                # third-person statement
    quote: str               # verbatim source span (checked in code)
    slot_key: NotRequired[str | None]
    value: NotRequired[object]
    kind_hint: str           # fact | decision | assumption | report_fact | ephemeral | option
    modality: NotRequired[str]
    provenance: str          # verified_artefact | founder_asserted | agent_inferred
    source: dict             # {type, ref_id?, field?, at?}
    user_direct: bool        # the founder typed it themselves: no R12 confirm
    valid_at: NotRequired[str | None]
    observed_at: str
    confirmed_at: NotRequired[str]


class Limits(TypedDict):
    top_k: int               # nearest notes considered
    max_judged: int          # neighbours sent to the judge (each judged in both orders)
    max_commit_attempts: int # version-guard retries before the job is retried later
    gate_cosine: float       # below this (and no same-slot note) → ADD without a judge


class MemoryWriteState(TypedDict):
    scope: Scope
    candidate: Candidate
    limits: Limits
    commit_attempts: int                       # incremented only in commit_node
    embedding: NotRequired[list[float]]
    embedding_model: NotRequired[str]
    neighbours: NotRequired[list[dict]]
    scope_version: NotRequired[int]
    judgements: NotRequired[Annotated[list[dict], merge_judgements]]
    decision: NotRequired[dict]
    confirm_id: NotRequired[str]
    confirm: NotRequired[dict]                 # the founder's answer: {choice: yes|change|skip|expired, value?}
    outcome: NotRequired[str]                  # added | added_option | added_historical | updated | invalidated | conflict | noop | duplicate | dropped
    written_note_ids: NotRequired[list[str]]
    flags: NotRequired[Annotated[list[str], operator.add]]
    status: NotRequired[str]
    error: NotRequired[dict]
