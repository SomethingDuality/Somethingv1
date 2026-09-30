"""The slot registry: facts that have exactly one current value per scope ("where is this founder
based", "what stage is this idea at"). Free-form facts have no slot.

  scope       which memory scope owns the slot (founder | idea | investor)
  node_field  the Node registry field it mirrors (profile/fields.js), or None if memory-only
  taxonomy    the taxonomy group its value must belong to, if any
  high_stakes R12: a change needs the founder's one-tap confirm unless they typed it themselves
  decay       how fast the fact fades in recall (none for slot facts)
"""
from dataclasses import dataclass

from app.shared import taxonomy


@dataclass(frozen=True)
class Slot:
    key: str
    scope: str
    label: str
    node_field: str | None = None
    taxonomy: str | None = None
    high_stakes: bool = False
    many: bool = False  # a list value (skills, sectors)


SLOTS: dict[str, Slot] = {s.key: s for s in [
    Slot("founder.location", "founder", "where you're based", node_field="location", high_stakes=True),
    Slot("founder.skills", "founder", "your skills", node_field="skills", taxonomy="skills", many=True),
    Slot("founder.interests", "founder", "the sectors you care about", node_field="interests", taxonomy="sectors", many=True),

    Slot("idea.title", "idea", "the idea's name", node_field="title"),
    Slot("idea.stage", "idea", "the stage", node_field="stage", taxonomy="ideaStages", high_stakes=True),
    Slot("idea.raising", "idea", "how much you're raising", node_field="raising", taxonomy="raisingBands", high_stakes=True),
    Slot("idea.sectors", "idea", "the sectors", node_field="tags", taxonomy="sectors", many=True),
    Slot("idea.looking_for", "idea", "who you're looking for", node_field="lookingFor", taxonomy="roles", many=True),
    Slot("idea.country", "idea", "the country you're starting in", high_stakes=True),
    Slot("idea.legal_entity", "idea", "the legal entity", high_stakes=True),
    Slot("idea.funding_raised", "idea", "the money raised so far", high_stakes=True),
    Slot("idea.pricing", "idea", "the pricing", high_stakes=True),
    Slot("idea.target_customer", "idea", "the target customer"),
    Slot("idea.business_model", "idea", "how it makes money"),
    Slot("idea.moat", "idea", "what keeps it ahead"),
]}

# Node fields that map to slots, per entity (for reconciling from fieldSources).
NODE_USER_FIELDS = {s.node_field: s for s in SLOTS.values() if s.scope == "founder" and s.node_field}
NODE_IDEA_FIELDS = {s.node_field: s for s in SLOTS.values() if s.scope == "idea" and s.node_field}


def get(key: str | None) -> Slot | None:
    return SLOTS.get(key) if key else None


def normalise_value(slot: Slot, value):
    """Returns the value in Node's terms (taxonomy ids), or None if it doesn't fit the slot."""
    if value is None:
        return None
    if slot.taxonomy:
        if slot.many:
            vals = value if isinstance(value, list) else [value]
            out = [taxonomy.normalise(slot.taxonomy, v) for v in vals]
            return [v for v in out if v] or None
        return taxonomy.normalise(slot.taxonomy, value)
    if isinstance(value, str):
        return value.strip()[:200] or None
    return value


def describe(slot: Slot, value) -> str:
    """A value in words, for confirms ("Delaware C-corp → UK Ltd, right?")."""
    if value is None or value == [] or value == "":
        return "nothing yet"
    if slot.taxonomy:
        vals = value if isinstance(value, list) else [value]
        return ", ".join(taxonomy.label(slot.taxonomy, v) for v in vals)
    return str(value)


def prompt_list(scope: str) -> str:
    """The slots an extractor may fill for this scope, for the prompt."""
    lines = []
    for s in SLOTS.values():
        if s.scope != scope:
            continue
        allowed = f" (one of: {', '.join(taxonomy.ids(s.taxonomy))})" if s.taxonomy else ""
        lines.append(f"- {s.key}: {s.label}{allowed}")
    return "\n".join(lines)
