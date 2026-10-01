"""Fixed copy for the review. The verdict label, its meaning, the risks and the split lines are
inserted by code, verbatim, so Something can never soften what Nothing said (research: relay
fidelity). The model only writes how to address each risk, and relay_check() rejects softening.
Copy rules (frontend_brief): sentence case, no exclamation marks, no "AI" language, plain words."""
import re

VERDICT_TEXT = {
    "needs_evidence": "Needs evidence",
    "almost_there": "Almost there",
    "ready": "Ready",
}

VERDICT_MEANING = {
    "needs_evidence": "Something this idea depends on has a real problem in what you've shown so far. The tests below are the cheapest way to settle it.",
    "almost_there": "The important parts are there, but some still rest only on your word. A few quick tests would settle them.",
    "ready": "What this idea depends on is backed by evidence you've shown.",
}

ABOUT = "This is about evidence, not your odds."

EFFORT = {"hours": "a few hours", "days": "a few days", "weeks": "a few weeks"}

STATUS_TEXT = {
    "accepted": "You said that's fair.",
    "resolved": "Settled: the review had missed what you'd already said.",
    "stands": "This still stands: it needs evidence, not argument.",
    "needs_test": "That would settle it once it's checked. Run the test, or add the proof to your idea.",
    "disputed": "Disputed: you and Nothing disagree, and that's shown as it is.",
}


def split_text(agree: int, of: int) -> str:
    if of <= 1:
        return ""
    if agree == of:
        return f"All {of} reviews flagged this."
    return f"{agree} of {of} reviews flagged this."


def cannot_judge(labels: list[str]) -> str:
    if not labels:
        return ""
    if len(labels) == 1:
        return f"There wasn't enough here to judge {labels[0].lower()}."
    return f"There wasn't enough here to judge {', '.join(lab.lower() for lab in labels[:-1])} or {labels[-1].lower()}."


def fallback_address(test: dict) -> str:
    return f"Start with the test: {test['text'].rstrip('.')}. It takes {EFFORT.get(test.get('effort'), 'a little time')}."


_SOFT = re.compile(r"\b(don'?t worry|no worries|great idea|amazing|brilliant|just a (small|minor)|minor issue|nothing to worry|you('| a)re (fine|good)|easily solved)\b", re.I)
_VERDICT = re.compile(r"\b(needs evidence|almost there|ready to|is ready|verdict|score)\b", re.I)
_NUM = re.compile(r"\d[\d,.]*")


def relay_check(text: str, allowed_numbers: set[str]) -> bool:
    """Something's how-to-address line may not soften, restate a verdict, or invent numbers."""
    if not text or len(text) > 400 or _SOFT.search(text) or _VERDICT.search(text) or "!" in text:
        return False
    return all(n.strip(".,") in allowed_numbers for n in _NUM.findall(text))
