"""Node deletes agent data from the collections listed in shared/agent-collections.json (P16).
If the agent writes a collection that isn't listed there, deletion would silently miss it."""
import json
from pathlib import Path

from app.core import db

SHARED = Path(__file__).resolve().parents[3] / "shared" / "agent-collections.json"
GENERATED = Path(__file__).resolve().parents[2] / "app" / "shared" / "agent-collections.generated.json"


def test_every_agent_collection_is_purgeable():
    listed = json.loads(SHARED.read_text())["collections"]
    written = set(db.INDEXES) | set(db.CHECKPOINT_COLLECTIONS)
    assert set(listed) == written
    for name, keys in listed.items():
        assert keys, name
        assert set(keys) <= {"user", "idea", "thread"}


def test_generated_copy_is_current():
    assert GENERATED.read_text() == SHARED.read_text(), "run: node shared/sync.mjs"
