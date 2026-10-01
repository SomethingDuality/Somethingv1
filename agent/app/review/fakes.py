"""Fake-mode scripts for the review prompts. Deterministic, built from the input, and varied enough
to exercise every path: splits between samples, all three labels, uncited blockers, rebuttal
classes. They are not a model of quality: real behaviour is measured in evals/ on real models."""
import re

from app.models import fake
from app.review.categories import CATEGORIES

_SENT = re.compile(r"[^.!?\n]+[.!?]?")
_DIGIT = re.compile(r"\d")
KEYWORDS = {
    "customer_problem": ("student", "canteen", "shop", "farmer", "famil", "customer", "user", "people", "problem", "hostel"),
    "solution_fit": ("app", "model", "ledger", "build", "pickup", "compost", "match", "vault", "logging"),
    "reach": ("college", "partner", "whatsapp", "channel", "signed", "pilot", "onboard"),
    "willingness_to_pay": ("pay", "paid", "price", "charge", "₹", "$", "per kilo", "fee", "revenue"),
    "alternatives_moat": ("instead", "competitor", "unlike", "only", "first"),
    "feasibility_execution": ("offline", "mb", "encrypt", "licen", "permit", "launched", "live", "built"),
}


@fake.register("review.brief")
def fake_brief(inp: dict, ctx: dict) -> dict:
    text = inp["text"]
    sents = [s.strip() for s in _SENT.findall(text) if len(s.split()) >= 4 and not s.strip().startswith(("Title:", "Stage:", "Sectors:", "Raising:"))]
    claims = [{"text": f"The founder states: {s.rstrip('.')}.", "quote": s, "specific": bool(_DIGIT.search(s))} for s in sents[:15]]
    first = sents[0] if sents else text[:120]
    low = text.lower()
    unknowns = [c.label for c in CATEGORIES if not any(k in low for k in KEYWORDS[c.id])][:6]
    return {"one_liner": f"A founder proposes: {first.rstrip('.')}.", "claims": claims, "unknowns": unknowns}


@fake.register("review.decompose")
def fake_decompose(inp: dict, ctx: dict) -> dict:
    claims = inp["brief"]["claims"]
    out = []
    for c in CATEGORIES:
        ids = [cl["id"] for cl in claims if any(k in cl["text"].lower() for k in KEYWORDS[c.id])][:3]
        out.append({"category": c.id, "statement": f"{c.question} holds for this idea.", "claim_ids": ids})
    return {"assumptions": out}


@fake.register("review.nothing")
def fake_nothing(inp: dict, ctx: dict) -> dict:
    i = inp["sample_idx"]
    claims = {c["id"]: c for c in inp["brief"]["claims"]}
    rows = []
    for a in inp["assumptions"]:
        cited = [x for x in a["claim_ids"] if x in claims]
        specific = any(claims[x]["specific"] for x in cited)
        if not cited:
            status, sev = "unknown", "important" if a["category"] in ("customer_problem", "willingness_to_pay") else "minor"
        elif specific:
            status, sev = "unverified", "important"
        else:
            # Vague claims on the core assumption: two of three samples call it blocking (a split).
            status = "unverified"
            sev = "blocking" if a["category"] == "customer_problem" and i != 2 else "important"
        rows.append({
            "assumption_id": a["id"],
            "title": {"customer_problem": "It isn't shown who has this problem badly enough",
                      "solution_fit": "It isn't shown this beats what people do now",
                      "reach": "How the first customers find it is unclear",
                      "willingness_to_pay": "It isn't shown anyone will pay this price",
                      "alternatives_moat": "What people use instead isn't addressed",
                      "feasibility_execution": "It isn't shown this can run at scale"}[a["category"]],
            "rationale": "The brief states it, but nothing on record backs it yet." if cited else "The brief says nothing about this.",
            "evidence_status": status, "severity": sev, "cites": cited[:2],
            "strongest_point": "A specific number is stated." if specific else "nothing shown yet",
            "cheapest_test": {"text": "Talk to five people who have this problem this week and ask what they do now.", "effort": "days"},
            "resolution_criteria": "Three of five describe the problem without being prompted.",
        })
    return {"assessments": rows}


@fake.register("review.steelman")
def fake_steelman(inp: dict, ctx: dict) -> dict:
    claims = inp["brief"]["claims"]
    strong = [c for c in claims if c["specific"]][:3] or claims[:1]
    return {
        "strengths": [{"text": f"A concrete detail to build on: {c['quote'].rstrip('.')}.", "claim_ids": [c["id"]]} for c in strong],
        "concessions": ["Most of it is still the founder's word."],
        "next_proof": "A short note from one paying customer, in their words.",
    }


@fake.register("review.relay")
def fake_relay(inp: dict, ctx: dict) -> dict:
    return {"address": [{"risk_id": r["assumption_id"], "text": "Pick the five people from your own network who fit best and ask them this week."}
                        for r in inp["rows"]]}


@fake.register("review.rebuttal_normalise")
def fake_rebuttal_normalise(inp: dict, ctx: dict) -> dict:
    t = inp["text"]
    if re.search(r"\b(you('| a)re wrong|change (the|your) (verdict|label))\b|!!", t, re.I):
        kind = "pressure"
    elif re.search(r"\b(the brief (already )?says|already (says|stated)|you misread|it says)\b", t, re.I):
        kind = "factual_correction"
    elif _DIGIT.search(t) or "http" in t:
        kind = "new_verifiable_evidence"
    else:
        kind = "argument_without_evidence"
    return {"kind": kind, "neutral_text": f"The founder states that {t.rstrip('.')}."}


@fake.register("review.rebuttal_judge")
def fake_rebuttal_judge(inp: dict, ctx: dict) -> dict:
    # Only a correction of what the brief already says resolves; new claims wait for a check.
    reb = inp["rebuttal"]
    if reb.get("kind") == "factual_correction":
        return {"rationale": "The brief already says this; the critique missed it.", "outcome": "resolved"}
    return {"rationale": "Plausible, but nobody has checked it yet.", "outcome": "needs_test"}
