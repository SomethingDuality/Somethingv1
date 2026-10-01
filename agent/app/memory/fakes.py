"""Fake-mode scripts for memory prompts: deterministic stand-ins that behave sensibly enough to run
the product and the tests without keys. Real behaviour is measured with evals/ on real models."""
import re

from app.memory import slots
from app.models import fake
from app.shared import taxonomy

_SENT = re.compile(r"[^.!?\n]+[.!?]?")
_CONSIDER = re.compile(r"\b(maybe|might|thinking about|considering|what if|could|perhaps)\b", re.I)
_REJECT = re.compile(r"\b(decided not to|dropped|won't|will not|no longer)\b", re.I)
_RULES = [
    ("idea.legal_entity", re.compile(r"\b(incorporat\w+|registered)\b.*?\b(as|in)\s+(an?\s+)?([A-Z][\w.\- ]{1,40}?(?:Ltd|LLC|Inc|C-corp|Pvt Ltd|LLP|corp))", re.I), 4),
    ("idea.pricing", re.compile(r"\b(charge|price|pricing|costs?)\b[^.]*?(\$|₹|rs\.?|inr|usd)\s?([\d,]+(?:\.\d+)?(?:\s*(?:per|/|a)\s*\w+)?)", re.I), 0),
    ("idea.country", re.compile(r"\b(?:launch|start|starting|based|operate)\w*\b[^.]*?\bin\s+(India|the US|USA|UK|Singapore|Germany|Canada|Kenya|Nigeria|Brazil)\b", re.I), 1),
    ("idea.stage", re.compile(r"\b(concept|prototype|mvp|launched)\b", re.I), 1),
]


def _slot_value(key: str, m: re.Match, grp: int):
    if key == "idea.pricing":
        return m.group(0).strip()
    return m.group(grp).strip()


@fake.register("memory.extract")
def fake_extract(inp: dict, ctx: dict) -> dict:
    text, scope = inp.get("text", ""), inp.get("scope", "idea")
    facts = []
    for sent in _SENT.findall(text):
        s = sent.strip()
        if len(s.split()) < 4:
            continue
        modality = "rejected" if _REJECT.search(s) else "considering" if _CONSIDER.search(s) else "decided"
        slot_key, value = None, None
        for key, rx, grp in _RULES:
            if not key.startswith(scope):
                continue
            m = rx.search(s)
            if m:
                slot_key, value = key, _slot_value(key, m, grp)
                if key == "idea.stage":
                    value = taxonomy.normalise("ideaStages", value)
                break
        facts.append({
            "text": f"The founder says: {s.rstrip('.')}.", "quote": s, "slot_key": slot_key, "value": value,
            "kind": "decision" if slot_key else "fact", "modality": modality, "valid_at": None,
        })
    return {"facts": facts[:12]}


def _words(t: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", t.lower())) - {"the", "a", "an", "founder", "says", "is", "it", "to", "of", "and", "in"}


@fake.register("memory.judge")
def fake_judge(inp: dict, ctx: dict) -> dict:
    old, new = inp["existing"], inp["new"]
    slot = slots.get(new.get("slot_key"))
    quote = new["text"].split()[0]
    modality = "considering" if _CONSIDER.search(new["text"]) else "rejected" if _REJECT.search(new["text"]) else "decided"
    if modality == "considering":
        rel = "hypothetical"
    elif slot and old.get("slot_key") == slot.key:
        rel = "same" if str(old.get("value")).lower() == str(new.get("value")).lower() else "changes"
    else:
        a, b = _words(old["text"]), _words(new["text"])
        overlap = len(a & b) / max(1, len(a | b))
        rel = "same" if overlap > 0.8 else "refines" if overlap > 0.45 else "unrelated"
    return {"rationale": f"fake judge: {rel}", "relation": rel, "modality": modality, "valid_at": None, "evidence_quote": quote}
