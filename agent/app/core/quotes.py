"""Every quote a model returns must appear verbatim in the source text (whitespace and case aside).
A fact whose quote doesn't verify is dropped: that is what keeps extraction and critiques tied to
what the founder actually wrote."""
import re
import unicodedata

_WS = re.compile(r"\s+")
_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-"})


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKC", text or "").translate(_QUOTES)
    return _WS.sub(" ", t).strip().lower()


def verify(quote: str | None, source: str, min_len: int = 4) -> bool:
    if not quote:
        return False
    q = norm(quote).strip(" .,;:!?\"'")
    return len(q) >= min_len and q in norm(source)
