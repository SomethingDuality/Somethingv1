"""Matching behind one interface. `InterimMatcher` works today from what we know; Prapti's Brain
(`BrainMatcher`) will implement the same `ideas_for()` on the same packets, and settings.matcher
switches between them. Every match carries plain reasons the person can read; scores stay inside
(no numbers to game, no score tiles).

Interim rules (provisional, uncalibrated; the weights live here, not in prompts):
  Investor ← idea   hard: the idea is raising, shares a sector when the investor set sectors.
                    score: sectors .35, stage fit .20, check fit .15, similarity .20, keywords .05, fresh .05
  Founder  ← idea   (co-founders) hard: the idea looks for a role the founder's skills fill.
                    score: role fit .45, sectors .20, similarity .15, same place .10, fresh .10
Pedigree never counts (R10)."""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol

import numpy as np

from app.core.settings import get_settings
from app.shared import taxonomy

# Which funding stages back which idea stages.
STAGE_FIT = {
    "concept": {"angel", "pre_seed", "grants"},
    "prototype": {"angel", "pre_seed", "seed", "grants"},
    "mvp": {"pre_seed", "seed", "angel"},
    "launched": {"seed", "series_a", "series_b_plus", "venture_debt"},
}
# Which skills fill which roles an idea looks for ("cofounder" = anyone with skills).
ROLE_SKILLS = {
    "cto": {"engineering"}, "frontend": {"engineering", "design"}, "backend": {"engineering"}, "fullstack": {"engineering"},
    "designer": {"design"}, "pm": {"product"}, "marketing": {"marketing", "sales"}, "ml_engineer": {"ai_ml", "engineering"},
    "community": {"marketing", "operations"},
}
BANDS = {o["id"]: (o.get("min"), o.get("max")) for o in taxonomy.taxonomy().get("raisingBands", [])}
MIN_SCORE = 0.3


@dataclass
class Match:
    idea_id: str
    score: float
    reasons: list[str]
    parts: dict = field(default_factory=dict)


class Matcher(Protocol):
    name: str

    async def ideas_for(self, person: dict, ideas: list[dict], sims: dict[str, float], k: int) -> list[Match]: ...


def _fresh(idea: dict, days: int = 7) -> bool:
    at = idea.get("created_at")
    if not at:
        return False
    try:
        when = datetime.fromisoformat(str(at).replace("Z", "+00:00"))
    except ValueError:
        return False
    return when > datetime.now(timezone.utc) - timedelta(days=days)


def _money(n) -> str:
    return f"${n:,.0f}"


def _lower(label: str) -> str:
    """Sentence-case a label inside a sentence, keeping acronyms ("ML engineer", "AI / ML")."""
    first = label.split(" ")[0]
    return label if any(c.isupper() for c in first[1:]) or first.isupper() else label[:1].lower() + label[1:]


def _and(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _city(location: str) -> str:
    return (location or "").split(",")[-1].strip().lower()


def investor_fit(inv: dict, idea: dict, sim: float) -> Match | None:
    if idea.get("raising") == "not_raising":
        return None
    shared = sorted(set(inv["sectors"]) & set(idea["sectors"]))
    if inv["sectors"] and not shared:
        return None
    reasons, parts = [], {}
    parts["sectors"] = len(shared) / max(1, len(idea["sectors"])) if inv["sectors"] and idea["sectors"] else 0.5
    if shared:
        reasons.append(f"In your sectors: {', '.join(taxonomy.label('sectors', s) for s in shared)}.")
    if inv["stage_focus"] and idea.get("stage"):
        backs = sorted(set(inv["stage_focus"]) & STAGE_FIT.get(idea["stage"], set()))
        parts["stage"] = 1.0 if backs else 0.0
        if backs:
            reasons.append(f"At a stage you back: {taxonomy.label('ideaStages', idea['stage'])}, "
                           f"which fits {', '.join(taxonomy.label('fundingStages', b) for b in backs)}.")
    else:
        parts["stage"] = 0.5
    lo, hi = BANDS.get(idea.get("raising") or "", (None, None))
    if inv.get("min_check") is not None and hi:
        parts["check"] = 0.0 if inv["min_check"] > hi else 1.0
        if parts["check"]:
            span = f"{_money(inv['min_check'])}–{_money(inv['max_check'])}" if inv.get("max_check") else f"from {_money(inv['min_check'])}"
            reasons.append(f"Raising {taxonomy.label('raisingBands', idea['raising'])}; your checks are {span}.")
    else:
        parts["check"] = 0.5
    hits = [k for k in inv.get("keywords", []) if k and k.lower() in idea["text"].lower()]
    parts["keywords"] = 1.0 if hits else 0.0
    if hits:
        reasons.append(f"Mentions what you look for: {', '.join(hits[:3])}.")
    parts["similarity"] = max(0.0, sim)
    if sim >= 0.5:
        reasons.append("Close to what you describe in your profile.")
    parts["fresh"] = 1.0 if _fresh(idea) else 0.0
    if parts["fresh"]:
        reasons.append("Posted this week.")
    score = (.35 * parts["sectors"] + .20 * parts["stage"] + .15 * parts["check"] + .20 * parts["similarity"]
             + .05 * parts["keywords"] + .05 * parts["fresh"])
    return Match(idea["id"], round(score, 4), reasons, parts)


def founder_fit(me: dict, idea: dict, sim: float) -> Match | None:
    wanted = idea.get("looking_for") or []
    if not wanted or not me["skills"]:
        return None
    skills = set(me["skills"])
    filled = [r for r in wanted if (r == "cofounder" and skills) or (ROLE_SKILLS.get(r, set()) & skills)]
    if not filled:
        return None
    reasons, parts = [], {}
    parts["roles"] = len(filled) / len(wanted)
    mine = sorted({s for r in filled for s in (ROLE_SKILLS.get(r) or skills) if s in skills})
    reasons.append(f"Looking for {_and([_lower(taxonomy.label('roles', r)) for r in filled])}; "
                   f"you bring {_and([_lower(taxonomy.label('skills', s)) for s in mine])}.")
    shared = sorted(set(me["sectors"]) & set(idea["sectors"]))
    parts["sectors"] = len(shared) / max(1, len(idea["sectors"])) if shared else 0.0
    if shared:
        reasons.append(f"In sectors you care about: {', '.join(taxonomy.label('sectors', s) for s in shared)}.")
    parts["similarity"] = max(0.0, sim)
    same = _city(me.get("location", "")) and _city(me["location"]) == _city(idea.get("founder_location", ""))
    parts["place"] = 1.0 if same else 0.0
    if same:
        reasons.append(f"Also in {idea['founder_location'].split(',')[-1].strip()}.")
    parts["fresh"] = 1.0 if _fresh(idea) else 0.0
    if parts["fresh"]:
        reasons.append("Posted this week.")
    score = .45 * parts["roles"] + .20 * parts["sectors"] + .15 * parts["similarity"] + .10 * parts["place"] + .10 * parts["fresh"]
    return Match(idea["id"], round(score, 4), reasons, parts)


class InterimMatcher:
    name = "interim-v1"

    async def ideas_for(self, person: dict, ideas: list[dict], sims: dict[str, float], k: int) -> list[Match]:
        fit = investor_fit if person["role"] == "Investor" else founder_fit
        out = [m for i in ideas if (m := fit(person, i, sims.get(i["id"], 0.0))) and m.score >= MIN_SCORE]
        out.sort(key=lambda m: (-m.score, m.idea_id))
        return out[:k]


class BrainMatcher:
    """Prapti's model goes here (same packets in, same Match list out)."""
    name = "brain"

    async def ideas_for(self, person: dict, ideas: list[dict], sims: dict[str, float], k: int) -> list[Match]:
        raise NotImplementedError("The Brain isn't connected yet; set MATCHER=interim")


def get_matcher() -> Matcher:
    return BrainMatcher() if get_settings().matcher == "brain" else InterimMatcher()


def similarity(person_vec: np.ndarray | None, idea_vecs: dict[str, np.ndarray]) -> dict[str, float]:
    if person_vec is None or not person_vec.size:
        return {}
    return {k: float(v @ person_vec) for k, v in idea_vecs.items() if v.size == person_vec.size}
