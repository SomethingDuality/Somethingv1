"""Nothing's verdict as code (R1, R2). Three founder-facing labels, about evidence, not odds:

  Needs evidence  iff at least 2 of the samples call the same assumption blocking AND at least one
                  of those blocking votes cites a claim or evidence (R2); or the majority says an
                  assumption is contradicted by what was cited.
  Almost there    any important-or-worse point whose evidence is unverified or unknown, or
                  (proposed cap, open item for Somay) nothing verified exists yet: until the
                  verifiers ship (phase D), "Ready" would mean "nobody checked".
  Ready           otherwise.

The rule that fired is returned (rule_trace) and stored, so every label can be explained."""

LABELS = {
    "needs_evidence": "Needs evidence",
    "almost_there": "Almost there",
    "ready": "Ready",
}


def verdict(rows: list[dict], *, min_agreeing: int = 2, verified_count: int = 0, cap_without_verified: bool = True) -> dict:
    trace: list[str] = []
    for r in rows:
        if r["blocking_votes"] >= min_agreeing and r["blocking_cited_votes"] >= 1:
            trace.append(f"{r['assumption_id']}: {r['blocking_votes']} blocking votes, {r['blocking_cited_votes']} cited")
            return {"label": "needs_evidence", "rule_trace": trace}
        if r["evidence_status"] == "contradicted" and r["cites"] and r["severity"] in ("blocking", "important"):
            trace.append(f"{r['assumption_id']}: majority contradicted, cited")
            return {"label": "needs_evidence", "rule_trace": trace}
    open_points = [r for r in rows if r["severity"] in ("blocking", "important") and r["evidence_status"] in ("unverified", "unknown")]
    if open_points:
        trace.append(f"{len(open_points)} important point(s) not yet shown: {', '.join(r['assumption_id'] for r in open_points)}")
        return {"label": "almost_there", "rule_trace": trace}
    if cap_without_verified and verified_count == 0:
        trace.append("no verified evidence yet: capped at almost_there")
        return {"label": "almost_there", "rule_trace": trace}
    trace.append("every important point is backed")
    return {"label": "ready", "rule_trace": trace}
