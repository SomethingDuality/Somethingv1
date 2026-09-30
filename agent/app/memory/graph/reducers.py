"""His merge_perspectives pattern: parallel writers merge by key, the latest entry wins.
judge_pair runs once per (note, order) through Send; a retry overwrites its own entry."""


def merge_judgements(left: list[dict] | None, right: list[dict] | None) -> list[dict]:
    if not left:
        return list(right or [])
    if not right:
        return list(left)
    merged = {(j["note_id"], j["order"]): j for j in left}
    for j in right:
        merged[(j["note_id"], j["order"])] = j
    return list(merged.values())
