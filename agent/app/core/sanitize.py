"""Founder text before it reaches a model (research: injection; a founder with unlimited retries
will eventually inject any judge).

  clean()    NFKC, and strip what a reader can't see but a model can: tag characters
             (U+E0000-E007F), zero-width and bidi controls, variation selectors.
  signals()  strings that imitate our prompts or a judge's output ("ignore the above", fake
             verdict JSON, "## Model Outputs"). They never change a verdict: they flag the review
             for the human queue (R4).
  spotlight() wraps the text in delimiters the prompt declares as data, never instructions.
"""
import re
import unicodedata

_INVISIBLE = re.compile(
    "[\U000e0000-\U000e007f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufe00-\ufe0f\ufeff]"
)
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

_SIGNALS = {
    "ignore_instructions": re.compile(r"\b(ignore|disregard|forget)\b.{0,40}\b(previous|above|prior|earlier|all)\b.{0,40}\b(instructions?|prompts?|rules?)\b", re.I | re.S),
    "role_claim": re.compile(r"\b(you are now|act as|system prompt|developer message)\b", re.I),
    "fake_verdict": re.compile(r"(\"?(verdict|label|evidence_status|severity|relation)\"?\s*:\s*\"?(ready|almost|needs|blocking|same|refines)|needs evidence\s*/\s*almost there)", re.I),
    "template_forgery": re.compile(r"(#{2,}\s*(model outputs?|system|assistant|judge)|<\s*/?\s*founder_text\b[^>]*>|thought process\s*:)", re.I),
    "invisible_text": re.compile("[\U000e0000-\U000e007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]"),
}


def clean(text: str | None, limit: int = 5000) -> str:
    t = unicodedata.normalize("NFKC", text or "")
    t = _INVISIBLE.sub("", t)
    t = _CONTROL.sub(" ", t)
    return t.strip()[:limit]


def signals(raw: str | None) -> list[str]:
    raw = raw or ""
    return [name for name, rx in _SIGNALS.items() if rx.search(raw)]


def spotlight(text: str, tag: str = "founder_text") -> str:
    # The founder can't close our delimiter: any copy of the tag inside the text is defused.
    safe = re.sub(rf"<\s*/?\s*{tag}\b[^>]*>", "[tag removed]", text, flags=re.I)
    return f"<{tag}>\n{safe}\n</{tag}>"
