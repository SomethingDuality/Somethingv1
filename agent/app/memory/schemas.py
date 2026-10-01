"""Memory schemas: what the extractor and the judge return (structured output), and the
constants the decision table works with."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Provenance = Literal["verified_artefact", "founder_asserted", "agent_inferred"]
Relation = Literal["same", "refines", "changes", "contradicts", "unrelated", "hypothetical"]
Modality = Literal["decided", "considering", "rejected"]
Kind = Literal["fact", "decision", "assumption", "report_fact", "option", "ephemeral"]
Op = Literal["ADD", "ADD_OPTION", "ADD_HISTORICAL", "ADD_CONFLICT", "UPDATE", "INVALIDATE", "NOOP"]

# Higher wins a conflict. A founder's confirmation lifts an agent inference to founder_asserted.
TIER = {"verified_artefact": 3, "founder_asserted": 2, "agent_inferred": 1}
DECAY = {"fact": "none", "decision": "none", "option": "slow", "assumption": "slow", "report_fact": "slow", "ephemeral": "fast"}


class ExtractedFact(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(description="The fact as one short third-person sentence, e.g. 'The founder charges canteens per kilo.'")
    quote: str = Field(description="The exact words from the source text this comes from, copied verbatim.")
    slot_key: str | None = Field(description="One of the listed slot keys if the fact sets that slot, else null.")
    value: str | None = Field(description="For a slot: the value (a listed id when ids are given), else null.")
    kind: Literal["fact", "decision", "assumption", "ephemeral"]
    modality: Modality = Field(description="decided = it is so / they chose it; considering = an option or a 'what if'; rejected = ruled out.")
    valid_at: str | None = Field(description="ISO date when this became true, only if the text says so ('since March 2026'), else null.")


class Extraction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    facts: list[ExtractedFact]


class Judgement(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rationale: str = Field(description="One sentence on how NEW relates to EXISTING.")
    relation: Relation
    modality: Modality = Field(description="Is NEW stated as decided, only being considered, or rejected?")
    valid_at: str | None = Field(description="ISO date NEW became true if NEW says so, else null.")
    evidence_quote: str = Field(description="The words in NEW that decide the relation, verbatim.")
