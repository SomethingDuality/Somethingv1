"""The six assumption categories Nothing checks (SO0 CR_DECOMPOSE; the categories were never
defined anywhere, so these are Claude's, provisional). There is deliberately no team/pedigree
category (R10): feasibility is judged on what the idea needs, never on schools or employers."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    id: str
    label: str        # founder-facing, sentence case
    question: str     # what Nothing asks
    evidence: str     # what counts as evidence here


CATEGORIES: list[Category] = [
    Category("customer_problem", "Who has the problem",
             "Who has this problem, how often, and what it costs them today",
             "interviews with named segments, sign-ups, observed workarounds, pre-orders"),
    Category("solution_fit", "Why this beats what they do now",
             "Why this beats what those people do now",
             "prototype usage, repeat use, pilot results"),
    Category("reach", "How the first customers find it",
             "How the first 100 customers find it and choose it",
             "channel tests, partners who agreed, bottom-up counts of reachable people"),
    Category("willingness_to_pay", "Who pays, and whether the numbers work",
             "Who pays, how much, and whether the unit numbers work",
             "paid pilots, price tests, real orders (letters of intent stay the founder's word)"),
    Category("alternatives_moat", "What they use instead",
             "What people use instead (including nothing) and why this keeps winning",
             "named alternatives and why users switch or stay"),
    Category("feasibility_execution", "Whether it can be built and run",
             "Whether it can be built, delivered and made legal with the resources it needs",
             "a working build or live link, permissions or licences identified, a resource plan; never schools, employers or titles"),
]
BY_ID = {c.id: c for c in CATEGORIES}
IDS = [c.id for c in CATEGORIES]
