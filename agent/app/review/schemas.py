"""What each review prompt returns (structured output). Ids for claims and assumptions are given by
code, never trusted from a model; a cite that doesn't resolve is dropped in aggregate.py."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EvidenceStatus = Literal["verified", "unverified", "unknown", "contradicted"]
Severity = Literal["blocking", "important", "minor", "none"]
Effort = Literal["hours", "days", "weeks"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BriefClaim(_Strict):
    text: str = Field(description="The claim in neutral third person: 'The founder states that…'")
    quote: str = Field(description="The founder's exact words this claim comes from, copied verbatim.")
    specific: bool = Field(description="True if it has a number, a name, a date or a place.")


class IdeaBrief(_Strict):
    one_liner: str = Field(description="'A founder proposes …' in one neutral sentence, no praise, no doubt.")
    claims: list[BriefClaim] = Field(description="Every factual claim, as claims. At most 15.")
    unknowns: list[str] = Field(description="Things an investor would ask that the text doesn't say. At most 6, short.")


class Assumption(_Strict):
    category: Literal["customer_problem", "solution_fit", "reach", "willingness_to_pay", "alternatives_moat", "feasibility_execution"]
    statement: str = Field(description="What must be true for this idea to work, in this category, in one sentence.")
    claim_ids: list[str] = Field(description="Ids of the brief's claims that bear on it (e.g. c2). Empty if none.")


class Decomposition(_Strict):
    assumptions: list[Assumption]


class Test(_Strict):
    text: str = Field(description="The cheapest action that would show whether the assumption holds, one sentence.")
    effort: Effort


class Assessment(_Strict):
    assumption_id: str = Field(description="The id of the assumption assessed, e.g. a1.")
    title: str = Field(description="The risk in at most 12 plain words, e.g. 'Canteens may not pay per kilo'.")
    rationale: str = Field(description="Two sentences at most: why.")
    evidence_status: EvidenceStatus
    severity: Severity
    cites: list[str] = Field(description="Ids of the claims (c…) or evidence (e…) this rests on. Empty if none.")
    strongest_point: str = Field(description="What is genuinely strong in this area, or 'nothing shown yet'.")
    cheapest_test: Test
    resolution_criteria: str = Field(description="What result would settle it, e.g. '10 paid pilots at ₹8/kg or more'.")


class CritiqueSample(_Strict):
    assessments: list[Assessment]


class Strength(_Strict):
    text: str = Field(description="A specific strength, tied to what the founder showed.")
    claim_ids: list[str]


class Steelman(_Strict):
    strengths: list[Strength] = Field(description="At most 4.")
    concessions: list[str] = Field(description="The 1–2 weakest points, conceded honestly.")
    next_proof: str = Field(description="The single strongest proof the founder could show next.")


class Address(_Strict):
    risk_id: str
    text: str = Field(description="At most two sentences on how to address this risk.")


class RelayOut(_Strict):
    address: list[Address]


class RebuttalClass(_Strict):
    kind: Literal["new_verifiable_evidence", "factual_correction", "argument_without_evidence", "pressure"]
    neutral_text: str = Field(description="The rebuttal rewritten neutrally in third person: 'The founder states that…'")


class Ruling(_Strict):
    rationale: str
    outcome: Literal["resolved", "stands", "needs_test"]
