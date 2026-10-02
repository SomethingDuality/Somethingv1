"""From three independent Nothing samples to one critique, in code (R7: verdict aggregated in code,
no debate round). A model's output is never trusted on its own:
  - a cite that doesn't resolve to a claim (c…) or evidence (e…) is dropped;
  - 'blocking' without a valid cite becomes 'important' (a blocker has to rest on something);
  - minor points are capped per sample;
  - per assumption, the majority decides; disagreement is kept and shown ("2 of 3 reviews…").
Ranking happens here, after the critique (ranking before it had nothing to go on)."""
from collections import Counter

from app.core.errors import ProvidersExhausted
from app.review.categories import BY_ID

SEVERITY_ORDER = {"blocking": 3, "important": 2, "minor": 1, "none": 0}
STATUS_ORDER = {"contradicted": 3, "unverified": 2, "unknown": 1, "verified": 0}
# A tie on evidence is neither proof against the idea nor for it: it reads as "unverified", never
# "contradicted" (one sample out of a split must not decide the verdict, R2).
STATUS_TIE = {"unverified": 3, "unknown": 2, "contradicted": 1, "verified": 0}


def clean_sample(sample: dict, valid_ids: set[str], assumption_ids: set[str], max_minor: int) -> list[dict]:
    out, minors = [], 0
    for a in sample.get("assessments", []):
        if a.get("assumption_id") not in assumption_ids:
            continue
        a = dict(a)
        a["cites"] = [c for c in a.get("cites", []) if c in valid_ids]
        if a["severity"] == "blocking" and not a["cites"]:
            a["severity"] = "important"
            a["downgraded"] = True
        if a["severity"] == "minor":
            minors += 1
            if minors > max_minor:
                a["severity"] = "none"
        out.append(a)
    # One assessment per assumption per sample (the first wins).
    seen, unique = set(), []
    for a in out:
        if a["assumption_id"] not in seen:
            seen.add(a["assumption_id"])
            unique.append(a)
    return unique


def _majority(values: list[str], order: dict) -> tuple[str, int]:
    counts = Counter(values)
    best = max(counts.items(), key=lambda kv: (kv[1], order.get(kv[0], 0)))
    return best[0], best[1]


def aggregate(samples: list[dict], assumptions: list[dict], valid_ids: set[str], *, min_samples: int = 2, max_minor: int = 2) -> list[dict]:
    a_ids = {a["id"] for a in assumptions}
    cleaned = [clean_sample(s, valid_ids, a_ids, max_minor) for s in samples if s and not s.get("failed")]
    cleaned = [c for c in cleaned if c]
    if len(cleaned) < min_samples:
        raise ProvidersExhausted(f"only {len(cleaned)} usable critique samples")
    n = len(cleaned)
    rows = []
    for a in assumptions:
        votes = [x for c in cleaned for x in c if x["assumption_id"] == a["id"]]
        if not votes:
            continue
        severity, sev_n = _majority([v["severity"] for v in votes], SEVERITY_ORDER)
        status, _ = _majority([v["evidence_status"] for v in votes], STATUS_TIE)
        backing = [v for v in votes if v["severity"] == severity] or votes
        lead = backing[0]
        cites = sorted({c for v in backing for c in v["cites"]})
        blocking_votes = sum(1 for v in votes if v["severity"] == "blocking")
        blocking_cited = sum(1 for v in votes if v["severity"] == "blocking" and v["cites"])
        contradicted_cited = sum(1 for v in votes if v["evidence_status"] == "contradicted" and v["cites"])
        rows.append({
            "assumption_id": a["id"], "category": a["category"], "statement": a["statement"],
            "title": lead["title"].strip()[:120], "rationale": lead["rationale"].strip()[:600],
            "severity": severity, "evidence_status": status,
            "agree": sev_n, "of": n, "blocking_votes": blocking_votes, "blocking_cited_votes": blocking_cited,
            "contradicted_cited_votes": contradicted_cited,
            "cites": cites, "strongest_point": lead["strongest_point"].strip()[:300],
            "test": {"text": lead["cheapest_test"]["text"].strip()[:300], "effort": lead["cheapest_test"]["effort"]},
            "criteria": lead["resolution_criteria"].strip()[:300],
        })
    rows.sort(key=lambda r: (-SEVERITY_ORDER[r["severity"]], -STATUS_ORDER[r["evidence_status"]], -r["agree"],
                             list(BY_ID).index(r["category"])))
    for rank, r in enumerate(rows, 1):
        r["rank"] = rank
    return rows
