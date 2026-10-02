"""The review's pure core: aggregation (cite checks, downgrades, majority, splits) and the verdict
truth table (R1/R2 + the cap without verified evidence)."""
import pytest

from app.core.errors import ProvidersExhausted
from app.review.aggregate import aggregate
from app.review.relay_templates import relay_check, split_text
from app.review.verdict import verdict

ASSUMPTIONS = [{"id": f"a{i}", "category": c, "statement": c}
               for i, c in enumerate(["customer_problem", "solution_fit", "reach", "willingness_to_pay", "alternatives_moat", "feasibility_execution"], 1)]
VALID = {"c1", "c2", "e1"}


def a(aid, sev="important", status="unverified", cites=("c1",), title=None):
    return {"assumption_id": aid, "title": title or f"risk {aid}", "rationale": "why", "evidence_status": status, "severity": sev,
            "cites": list(cites), "strongest_point": "s", "cheapest_test": {"text": f"test {aid}", "effort": "days"}, "resolution_criteria": "r"}


def sample(*assessments):
    return {"assessments": list(assessments)}


def test_needs_three_or_two_usable_samples():
    with pytest.raises(ProvidersExhausted):
        aggregate([sample(a("a1")), {"failed": True}], ASSUMPTIONS, VALID)


def test_uncited_blocking_is_downgraded_and_bad_cites_dropped():
    rows = aggregate([sample(a("a1", "blocking", cites=("c9",)))] * 3, ASSUMPTIONS, VALID)
    assert rows[0]["severity"] == "important" and rows[0]["cites"] == []


def test_majority_and_split_text():
    rows = aggregate([sample(a("a1", "blocking")), sample(a("a1", "blocking")), sample(a("a1", "minor"))], ASSUMPTIONS, VALID)
    r = rows[0]
    assert (r["severity"], r["agree"], r["of"], r["blocking_votes"], r["blocking_cited_votes"]) == ("blocking", 2, 3, 2, 2)
    assert split_text(2, 3) == "2 of 3 reviews flagged this."
    assert split_text(3, 3) == "All 3 reviews flagged this."


def test_rank_puts_blocking_contradicted_first():
    rows = aggregate([sample(a("a1", "important"), a("a4", "blocking", "contradicted"), a("a2", "minor"))] * 3, ASSUMPTIONS, VALID)
    assert [r["assumption_id"] for r in rows] == ["a4", "a1", "a2"]


def test_minor_points_are_capped_per_sample():
    many = sample(*[a(f"a{i}", "minor") for i in range(1, 7)])
    rows = aggregate([many] * 3, ASSUMPTIONS, VALID, max_minor=2)
    assert sum(1 for r in rows if r["severity"] == "minor") == 2


@pytest.mark.parametrize("votes,expected", [
    # two cited blocking votes -> needs evidence (R2)
    ((a("a1", "blocking"), a("a1", "blocking"), a("a1", "important")), "needs_evidence"),
    # only one blocking vote -> not needs evidence
    ((a("a1", "blocking"), a("a1", "important"), a("a1", "important")), "almost_there"),
    # two blocking votes but none cited -> downgraded, not needs evidence
    ((a("a1", "blocking", cites=()), a("a1", "blocking", cites=()), a("a1", "important")), "almost_there"),
    # contradicted majority with a cite -> needs evidence
    ((a("a1", "important", "contradicted"),) * 3, "needs_evidence"),
    # everything verified -> capped without verified evidence
    ((a("a1", "important", "verified"),) * 3, "almost_there"),
])
def test_verdict_truth_table(votes, expected):
    rows = aggregate([sample(v) for v in votes], ASSUMPTIONS, VALID)
    assert verdict(rows)["label"] == expected


def test_ready_only_with_verified_evidence():
    rows = aggregate([sample(a("a1", "important", "verified"))] * 3, ASSUMPTIONS, VALID)
    assert verdict(rows, verified_count=1)["label"] == "ready"
    assert verdict(rows, verified_count=0)["label"] == "almost_there"
    assert "capped" in verdict(rows)["rule_trace"][-1]


def test_relay_check_rejects_softening_verdicts_and_new_numbers():
    assert relay_check("Ask two canteen managers this week what they pay now.", set())
    assert not relay_check("Don't worry, this is a great idea.", set())
    assert not relay_check("Once this is done you're ready to raise.", set())
    assert not relay_check("Aim for 50 canteens.", set())
    assert relay_check("Aim for 50 canteens.", {"50"})
    assert not relay_check("Do it now!", set())


def test_one_contradicted_sample_cannot_decide_the_verdict():
    """R2: a three-way split, or 1 of 2 usable samples, isn't "at least 2 agree"."""
    split = aggregate([sample(a("a1", "important", "contradicted", cites=("c1",))), sample(a("a1", "important", "unverified")),
                       sample(a("a1", "important", "unknown"))], ASSUMPTIONS, VALID)
    assert split[0]["evidence_status"] == "unverified"
    assert verdict(split)["label"] == "almost_there"
    two = aggregate([sample(a("a1", "important", "contradicted", cites=("c1",))), sample(a("a1", "important", "unverified"))], ASSUMPTIONS, VALID)
    assert verdict(two)["label"] == "almost_there"
    agreed = aggregate([sample(a("a1", "important", "contradicted", cites=("c1",)))] * 2 + [sample(a("a1", "important", "unverified"))], ASSUMPTIONS, VALID)
    assert verdict(agreed)["label"] == "needs_evidence"
