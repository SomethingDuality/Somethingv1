"""The eval harness: metrics are right, and every suite runs end to end on fake models.
(Quality numbers come only from real models: `python -m evals.run_eval` with EVAL_CONFIRM_SPEND=yes.)"""
import pytest

from app.core import checkpointer
from app.core.runs import manager
from app.memory.graph.builder import compile_memory_write
from evals import metrics, suites
from evals.perturb import PERTURBATIONS
from evals.run_eval import eval_uri


def test_kappa_and_friends():
    assert metrics.cohen_kappa(["a", "b", "a", "b"], ["a", "b", "a", "b"]) == 1.0
    assert metrics.cohen_kappa(["a", "a", "b", "b"], ["a", "b", "a", "b"]) == 0.0
    assert metrics.accuracy([1, 2, 3], [1, 2, 4]) == 0.6667
    assert metrics.replicate_agreement([["x", "y"], ["x", "z"]]) == 0.5
    assert metrics.confusion(["a", "a"], ["a", "b"]) == {"a": {"a": 1, "b": 1}}
    assert metrics.improved("needs_evidence", "almost_there") and not metrics.improved("ready", "almost_there")


def test_eval_db_is_separate():
    assert eval_uri("mongodb://127.0.0.1:27018/something_dev?replicaSet=rs0") == "mongodb://127.0.0.1:27018/agent_eval?replicaSet=rs0"


def test_gold_sets_are_well_formed():
    rel = {"same", "refines", "changes", "contradicts", "unrelated", "hypothetical"}
    for it in suites.load_jsonl("gold/memory_judge.jsonl"):
        assert it["expected"]["relation"] in rel and it["labeled_by"]
    for it in suites.load_jsonl("gold/nothing.jsonl"):
        assert set(it["expected"]["labels"]) <= {"needs_evidence", "almost_there", "ready"}
    for it in suites.load_jsonl("gold/rebuttal_judge.jsonl"):
        assert it["expected"]["outcome"] in {"resolved", "needs_test", "stands"}
    for p in PERTURBATIONS.values():
        assert p("An idea.") != "An idea."


@pytest.mark.parametrize("name", ["memory_judge", "nothing", "rebuttal", "perturb"])
async def test_suites_run_on_fake_models(name):
    import app.memory.fakes  # noqa: F401
    import app.review.fakes  # noqa: F401
    report = await suites.SUITES[name](limit=2)
    assert "labeled_by" in report or "violations" in report


async def test_supersession_suite_passes_on_the_real_decision_code(fake_node):
    import app.memory.fakes  # noqa: F401
    manager.register("memory_write", compile_memory_write(checkpointer.saver()), durability="exit")
    report = await suites.supersession(node=fake_node)
    assert report["pass_rate"] == 1.0, report["failures"]
    assert report["op_accuracy"] == 1.0
