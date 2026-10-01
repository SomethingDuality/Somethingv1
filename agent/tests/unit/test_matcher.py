"""The interim matcher's rules and the reasons it gives."""
from datetime import datetime, timezone

from app.brain.matcher import InterimMatcher, founder_fit, investor_fit

NOW = datetime.now(timezone.utc).isoformat()


def idea(**kw):
    base = {"id": "i1", "founder_id": "f1", "title": "Campus compost", "description": "Composting for canteens.",
            "text": "Campus compost. Composting for canteens.", "sectors": ["climate"], "stage": "mvp",
            "raising": "25k_100k", "looking_for": ["backend"], "founder_location": "Kothrud, Pune", "created_at": NOW, "facts": {}}
    return {**base, **kw}


def investor(**kw):
    base = {"id": "v1", "role": "Investor", "sectors": ["climate"], "stage_focus": ["seed"], "min_check": 5000,
            "max_check": 50000, "keywords": ["compost"], "text": "", "exclude": set(), "ready": True}
    return {**base, **kw}


def founder(**kw):
    base = {"id": "f2", "role": "Founder", "skills": ["engineering"], "sectors": ["climate"], "location": "Pune",
            "text": "", "exclude": set(), "ready": True}
    return {**base, **kw}


def test_investor_fit_reasons():
    m = investor_fit(investor(), idea(), 0.6)
    assert m.score > 0.8
    text = " ".join(m.reasons)
    assert "In your sectors: Climate" in text and "MVP" in text and "Seed" in text
    assert "your checks are $5,000–$50,000" in text and "compost" in text and "Posted this week." in text


def test_investor_hard_filters():
    assert investor_fit(investor(), idea(raising="not_raising"), 0.9) is None
    assert investor_fit(investor(sectors=["fintech"]), idea(), 0.9) is None
    assert investor_fit(investor(sectors=[]), idea(), 0.0) is not None, "no sectors set: no sector filter"
    big = investor_fit(investor(min_check=500000), idea(raising="lt_25k"), 0.0)
    assert big.parts["check"] == 0.0, "a minimum check bigger than the whole round doesn't fit"


def test_founder_fit_needs_a_role_their_skills_fill():
    m = founder_fit(founder(), idea(), 0.0)
    assert m.reasons[0] == "Looking for backend developer; you bring engineering."
    assert "Also in Pune." in m.reasons
    assert founder_fit(founder(skills=["design"]), idea(), 0.0) is None
    assert founder_fit(founder(), idea(looking_for=[]), 0.0) is None
    assert founder_fit(founder(skills=["sales"]), idea(looking_for=["cofounder"]), 0.0) is not None
    ml = founder_fit(founder(skills=["ai_ml", "engineering"]), idea(looking_for=["ml_engineer", "backend"]), 0.0)
    assert ml.reasons[0] == "Looking for ML engineer and backend developer; you bring AI / ML and engineering."


async def test_ranking_and_threshold():
    ideas = [idea(id="a", sectors=["climate"]), idea(id="b", sectors=["climate", "fintech", "health"], stage="launched", created_at=None),
             idea(id="c", sectors=["fintech"])]
    out = await InterimMatcher().ideas_for(investor(), ideas, {"a": 0.9, "b": 0.1}, k=5)
    assert [m.idea_id for m in out][0] == "a" and "c" not in [m.idea_id for m in out]
