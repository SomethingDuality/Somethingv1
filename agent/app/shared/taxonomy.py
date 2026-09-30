"""The shared taxonomy (shared/taxonomy.json, synced here by shared/sync.mjs)."""
import json
from functools import lru_cache
from pathlib import Path

_PATH = Path(__file__).parent / "taxonomy.generated.json"


@lru_cache
def taxonomy() -> dict:
    return json.loads(_PATH.read_text())


def ids(group: str) -> list[str]:
    return [o["id"] for o in taxonomy().get(group, [])]


def label(group: str, value: str) -> str:
    for o in taxonomy().get(group, []):
        if o["id"] == value:
            return o["label"]
    return value


def normalise(group: str, value) -> str | None:
    """A free-text value to a taxonomy id (by id, label or alias), or None."""
    if value is None:
        return None
    v = str(value).strip().lower()
    for o in taxonomy().get(group, []):
        names = [o["id"], o["label"], *o.get("aliases", [])]
        if any(v == str(n).strip().lower() for n in names):
            return o["id"]
    return None
