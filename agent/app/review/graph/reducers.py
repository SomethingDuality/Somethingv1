def merge_by_sample_idx(left: list[dict] | None, right: list[dict] | None) -> list[dict]:
    """The three Nothing samples write in parallel; a retried sample replaces its own entry."""
    merged = {s["sample_idx"]: s for s in (left or [])}
    for s in right or []:
        merged[s["sample_idx"]] = s
    return [merged[k] for k in sorted(merged)]
