"""The founder-facing view of a review: the only shape that leaves the agent (in SSE events and in
GET /reviews/:id). Raw samples, rationales of other samples, prompts and injection flags stay
inside. Investors never get any of it (R9)."""
from app.review.categories import BY_ID
from app.review.relay_templates import ABOUT, STATUS_TEXT, VERDICT_MEANING, VERDICT_TEXT, cannot_judge, split_text


def brief_view(brief: dict | None) -> dict | None:
    if not brief:
        return None
    return {
        "oneLiner": brief["one_liner"],
        "claims": [{"id": c["id"], "text": c["text"], "founderStated": c.get("founder_stated", True)} for c in brief["claims"]],
        "unknowns": brief.get("unknowns", []),
    }


def nothing_view(rows: list[dict], verdict: dict, brief: dict, risk_state: dict, max_risks: int) -> dict:
    claims = {c["id"]: c for c in brief.get("claims", [])}
    shown = [r for r in rows if r["severity"] in ("blocking", "important")][:max_risks]
    risks = []
    for r in shown:
        quote_claim = next((claims[c] for c in r["cites"] if c in claims), None)
        st = risk_state.get(r["assumption_id"], {})
        risks.append({
            "id": r["assumption_id"],
            "category": r["category"],
            "categoryLabel": BY_ID[r["category"]].label,
            "title": r["title"],
            "why": r["rationale"],
            "quote": quote_claim["quote"] if quote_claim else None,
            "founderStated": bool(quote_claim and quote_claim.get("founder_stated", True)),
            "split": {"agree": r["agree"], "of": r["of"], "text": split_text(r["agree"], r["of"])},
            "test": r["test"],
            "criteria": r["criteria"],
            "status": st.get("status", "open"),
            "statusText": STATUS_TEXT.get(st.get("status"), ""),
            "ruling": st.get("ruling"),
        })
    unknown = [BY_ID[r["category"]].label for r in rows if r["evidence_status"] == "unknown" and r["severity"] in ("none", "minor")]
    return {
        "verdict": {"label": verdict["label"], "text": VERDICT_TEXT[verdict["label"]], "meaning": VERDICT_MEANING[verdict["label"]], "about": ABOUT},
        "risks": risks,
        "cannotJudge": cannot_judge(unknown),
    }


def something_view(steelman: dict | None, address: list[dict], brief: dict) -> dict | None:
    if not steelman:
        return None
    return {
        "strengths": [{"text": s["text"]} for s in steelman.get("strengths", [])][:4],
        "concessions": steelman.get("concessions", [])[:2],
        "address": address,
        "nextProof": steelman.get("next_proof", ""),
    }


def full_view(state: dict) -> dict:
    """The whole view from graph state (stored on agent_reviews after every step)."""
    brief = state.get("brief") or {}
    return {
        "reviewId": state["review_id"],
        "status": state.get("status", "running"),
        "readers": state.get("readers", []),
        "subject": state.get("subject"),
        "ideaId": state.get("idea_id"),
        "round": state.get("round", 0),
        "maxRounds": state["limits"]["max_rebuttal_rounds"],
        "brief": brief_view(state.get("brief")),
        "nothing": nothing_view(state["aggregate"], state["verdict"], brief, state.get("risk_state", {}), state["limits"]["max_risks_shown"])
        if state.get("verdict") else None,
        "something": something_view(state.get("steelman"), state.get("address", []), brief),
        "error": state.get("error"),
    }
