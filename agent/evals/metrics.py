"""Scoring for the evals (research: report Cohen's κ, confusion matrices, AB/BA position consistency
and replicate agreement; never optimise on thumbs-up)."""
from collections import Counter


def accuracy(truth: list, pred: list) -> float:
    return round(sum(t == p for t, p in zip(truth, pred, strict=True)) / len(truth), 4) if truth else 0.0


def cohen_kappa(truth: list, pred: list) -> float:
    """Agreement beyond chance. 1 = perfect, 0 = chance, below 0 = worse than chance."""
    n = len(truth)
    if not n:
        return 0.0
    labels = sorted(set(truth) | set(pred))
    po = sum(t == p for t, p in zip(truth, pred, strict=True)) / n
    ct, cp = Counter(truth), Counter(pred)
    pe = sum((ct[label] / n) * (cp[label] / n) for label in labels)
    return round(1.0 if pe == 1 else (po - pe) / (1 - pe), 4)


def confusion(truth: list, pred: list) -> dict:
    """{true label: {predicted label: count}}."""
    out: dict = {}
    for t, p in zip(truth, pred, strict=True):
        out.setdefault(str(t), Counter())[str(p)] += 1
    return {k: dict(v) for k, v in out.items()}


def consistency(a: list, b: list) -> float:
    """Share of items where two runs (AB vs BA order, or two replicates) agree."""
    return accuracy(a, b)


def replicate_agreement(runs: list[list]) -> float:
    """Share of items where every replicate gave the same answer."""
    if not runs or not runs[0]:
        return 0.0
    items = list(zip(*runs, strict=True))
    return round(sum(len(set(map(str, x))) == 1 for x in items) / len(items), 4)


LABEL_RANK = {"needs_evidence": 0, "almost_there": 1, "ready": 2}


def improved(base_label: str, new_label: str) -> bool:
    """A perturbation that must never help: did it raise the verdict?"""
    return LABEL_RANK.get(new_label, 0) > LABEL_RANK.get(base_label, 0)
