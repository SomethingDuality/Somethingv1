"""The eval suites. Each returns a JSON-able report. They call the same functions the product uses
(the memory judge, the review graph, the rebuttal classifier and judge, the memory write graph),
so a score is a score of what founders get."""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from langgraph.checkpoint.memory import InMemorySaver

from app.core import db
from app.core.runs import manager
from app.memory import confirms, ingest, read
from app.memory.decide import combine
from app.memory.nodes.judge_pair_node import judge
from app.review import service as review_service
from app.review.graph.builder import compile_review
from app.review.nodes.rebuttal_judge_node import rule
from app.review.nodes.rebuttal_normalise_node import classify
from evals import metrics
from evals.perturb import PERTURBATIONS

HERE = Path(__file__).parent
EVAL_USER = "eval-user"


def load_jsonl(name: str) -> list[dict]:
    return [json.loads(line) for line in (HERE / name).read_text().splitlines() if line.strip()]


def _ctx(node: str) -> dict:
    return {"feature": "eval", "node": node, "user_id": EVAL_USER}


def _labeled_by(items: list[dict]) -> list[str]:
    return sorted({i.get("labeled_by", "?") for i in items})


# ---- memory judge ------------------------------------------------------------------------------

async def memory_judge(limit: int | None = None, replicates: int = 1) -> dict:
    items = load_jsonl("gold/memory_judge.jsonl")[:limit]
    truth = [i["expected"]["relation"] for i in items]
    runs, last = [], []
    for _ in range(replicates):
        rows = []
        for it in items:
            note = {"note_id": it["id"], "text": it["existing"]["text"], "valid_at": it["existing"]["valid_at"]}
            cand = {"text": it["new"]["text"], "observed_at": it["new"]["observed_at"]}
            ab = await judge(note, cand, "ab", _ctx("memory_judge"))
            ba = await judge(note, cand, "ba", _ctx("memory_judge"))
            rows.append({"id": it["id"], "expected": it["expected"], "ab": ab["relation"], "ba": ba["relation"],
                         "combined": combine(ab, ba)["relation"], "modality": ab["modality"]})
        runs.append([r["combined"] for r in rows])
        last = rows
    combined = runs[-1]
    return {
        "items": len(items), "labeled_by": _labeled_by(items),
        "accuracy_ab": metrics.accuracy(truth, [r["ab"] for r in last]),
        "accuracy_ba": metrics.accuracy(truth, [r["ba"] for r in last]),
        "accuracy_combined": metrics.accuracy(truth, combined),
        "kappa_combined": metrics.cohen_kappa(truth, combined),
        "ab_ba_consistency": metrics.consistency([r["ab"] for r in last], [r["ba"] for r in last]),
        "modality_accuracy": metrics.accuracy([i["expected"]["modality"] for i in items], [r["modality"] for r in last]),
        "replicate_agreement": metrics.replicate_agreement(runs) if replicates > 1 else None,
        "confusion": metrics.confusion(truth, combined),
        "misses": [r for r in last if r["combined"] != r["expected"]["relation"]],
    }


# ---- the review (Nothing) ----------------------------------------------------------------------

async def review_offline(text: str, readers: tuple[str, ...] = ("nothing",)) -> dict:
    """Runs the review graph on typed text, in memory, up to the reaction pause. Returns its state."""
    graph = compile_review(InMemorySaver())
    rid = uuid.uuid4().hex
    state = {"review_id": rid, "user_id": EVAL_USER, "idea_id": None, "subject": "typed_text", "readers": list(readers),
             "limits": review_service.limits(), "round": 0, "status": "running", "typed_text": text}
    config = {"configurable": {"thread_id": rid, "run_id": rid, "user_id": EVAL_USER}}
    await graph.ainvoke(state, config)
    return (await graph.aget_state(config)).values


def _label(values: dict) -> str:
    return "failed" if values.get("status") == "failed" else (values.get("verdict") or {}).get("label", "none")


def _flagged(values: dict) -> list[str]:
    rows = [r for r in values.get("aggregate") or [] if r["severity"] in ("blocking", "important")][:3]
    return [r["category"] for r in rows]


async def nothing(limit: int | None = None, replicates: int = 1) -> dict:
    items = load_jsonl("gold/nothing.jsonl")[:limit]
    runs, last = [], []
    for _ in range(replicates):
        rows = []
        for it in items:
            values = await review_offline(it["text"])
            label, flagged = _label(values), _flagged(values)
            exp = it["expected"]
            rows.append({"id": it["id"], "label": label, "flagged": flagged, "expected": exp,
                         "label_ok": label in exp["labels"], "never_violated": label in exp.get("never", []),
                         "flags_ok": all(c in flagged for c in exp.get("must_flag", []))})
        runs.append([r["label"] for r in rows])
        last = rows
    truth = [i["expected"]["labels"][0] for i in items]
    pred = runs[-1]
    must = [(r, c) for r in last for c in r["expected"].get("must_flag", [])]
    return {
        "items": len(items), "labeled_by": _labeled_by(items),
        "label_in_allowed": round(sum(r["label_ok"] for r in last) / max(1, len(last)), 4),
        "never_violations": sum(r["never_violated"] for r in last),
        "must_flag_recall": round(sum(c in r["flagged"] for r, c in must) / max(1, len(must)), 4),
        "kappa_vs_primary_label": metrics.cohen_kappa(truth, pred),
        "replicate_agreement": metrics.replicate_agreement(runs) if replicates > 1 else None,
        "confusion": metrics.confusion(truth, pred),
        "misses": [r for r in last if not (r["label_ok"] and r["flags_ok"]) or r["never_violated"]],
    }


# ---- rebuttals ---------------------------------------------------------------------------------

async def rebuttal(limit: int | None = None, replicates: int = 1) -> dict:
    items = load_jsonl("gold/rebuttal_judge.jsonl")[:limit]
    rows = []
    for it in items:
        row = it["critique"]
        out = await classify(row, it["reply"], _ctx("rebuttal_normalise"))
        outcome = "stands"
        if out["kind"] in ("new_verifiable_evidence", "factual_correction"):
            outcome = (await rule(row, out, it["id"], _ctx("rebuttal_judge")))["outcome"]
        rows.append({"id": it["id"], "kind": out["kind"], "outcome": outcome, "expected": it["expected"]})
    kt, kp = [i["expected"]["kind"] for i in items], [r["kind"] for r in rows]
    ot, op = [i["expected"]["outcome"] for i in items], [r["outcome"] for r in rows]
    resolved_wrongly = [r for r in rows if r["outcome"] == "resolved" and r["expected"]["outcome"] != "resolved"]
    return {
        "items": len(items), "labeled_by": _labeled_by(items),
        "kind_accuracy": metrics.accuracy(kt, kp), "outcome_accuracy": metrics.accuracy(ot, op),
        "outcome_kappa": metrics.cohen_kappa(ot, op),
        "wrongly_resolved": len(resolved_wrongly),  # the costly error: a founder talks a risk away
        "confusion_outcome": metrics.confusion(ot, op),
        "misses": [r for r in rows if r["kind"] != r["expected"]["kind"] or r["outcome"] != r["expected"]["outcome"]],
    }


# ---- memory supersession -----------------------------------------------------------------------

async def _step_candidate(case_id: str, i: int, st: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "candidate_id": f"{case_id}:{i}:{uuid.uuid4().hex[:8]}", "text": st["text"], "quote": st["text"],
        "slot_key": st.get("slot_key"), "value": st.get("value"), "kind_hint": st.get("kind_hint", "fact"),
        "modality": st.get("modality", "decided"), "provenance": st.get("provenance", "founder_asserted"),
        "source": {"type": st.get("source_type", "eval")}, "user_direct": bool(st.get("user_direct")),
        "valid_at": st.get("valid_at"), "observed_at": st.get("valid_at") or now,
    }


async def supersession(limit: int | None = None, replicates: int = 1, node=None) -> dict:
    data = json.loads((HERE / "supersession.json").read_text())
    cases = data["cases"][:limit]
    results, op_truth, op_pred = [], [], []
    for case in cases:
        idea_id = uuid.uuid4().hex[:24]
        if node is not None:
            node.add_user(EVAL_USER, "Founder")
            node.add_idea(idea_id, EVAL_USER, title=f"Eval {case['id']}")
        scope = ingest.idea_scope(EVAL_USER, idea_id)
        ops = []
        for i, st in enumerate(case["steps"]):
            cand = await _step_candidate(case["id"], i, st)
            run = await ingest.run_candidate(scope, cand)
            if run.get("status") == "interrupted" and st.get("confirm"):
                c = await db.col("agent_pending_confirms").find_one({"run_id": run["_id"], "status": "open"})
                if c:
                    await confirms.resolve(c["_id"], EVAL_USER, st["confirm"])
                    await manager.wait(run["_id"])
            dec = await db.col("agent_memory_decisions").find_one({"candidate.candidate_id": {"$regex": f"^{cand['candidate_id']}"}},
                                                                 sort=[("at", -1)])
            op = (dec or {}).get("decision", {}).get("op", "NOOP")
            ops.append(op)
            if st.get("expect_op"):
                op_truth.append(st["expect_op"])
                op_pred.append(op)
        finals = {}
        for slot, expected in case["expect"].items():
            got = await read.known([scope["scope_key"]], slot)
            finals[slot] = {"expected": expected, "got": (got or {}).get("value")}
        ok = all(v["expected"] == v["got"] for v in finals.values()) and all(
            s.get("expect_op") in (None, o) for s, o in zip(case["steps"], ops, strict=True))
        results.append({"id": case["id"], "ok": ok, "ops": ops, "finals": finals})
    per_op = {}
    for op in sorted(set(op_truth) | set(op_pred)):
        tp = sum(t == p == op for t, p in zip(op_truth, op_pred, strict=True))
        per_op[op] = {"precision": round(tp / max(1, op_pred.count(op)), 4), "recall": round(tp / max(1, op_truth.count(op)), 4)}
    return {
        "cases": len(cases), "labeled_by": [data.get("labeled_by", "?")],
        "pass_rate": round(sum(r["ok"] for r in results) / max(1, len(results)), 4),
        "op_accuracy": metrics.accuracy(op_truth, op_pred), "per_op": per_op,
        "failures": [r for r in results if not r["ok"]],
    }


# ---- perturbations -----------------------------------------------------------------------------

async def perturb(limit: int | None = 3, replicates: int = 1) -> dict:
    bases = load_jsonl("gold/nothing.jsonl")[: (limit or 3)]
    rows, violations = [], {k: 0 for k in PERTURBATIONS}
    injection_flagged = 0
    for b in bases:
        base_label = _label(await review_offline(b["text"]))
        for name, fn in PERTURBATIONS.items():
            values = await review_offline(fn(b["text"]))
            label = _label(values)
            bad = metrics.improved(base_label, label)
            violations[name] += int(bad)
            if name == "injection" and values.get("injection_signals"):
                injection_flagged += 1
            rows.append({"base": b["id"], "perturbation": name, "base_label": base_label, "label": label, "improved": bad})
    return {
        "bases": len(bases), "perturbations": list(PERTURBATIONS), "violations": violations,
        "total_violations": sum(violations.values()),
        "injection_flagged": f"{injection_flagged}/{len(bases)}",
        "improved": [r for r in rows if r["improved"]],
    }


SUITES = {"memory_judge": memory_judge, "nothing": nothing, "rebuttal": rebuttal, "supersession": supersession, "perturb": perturb}


async def cost_since(start: datetime) -> dict:
    rows = [r async for r in db.col("agent_usage").find({"at": {"$gte": start}, "feature": {"$in": ["eval", "review", "memory"]}})]
    by_node: dict = {}
    for r in rows:
        k = r.get("node") or "?"
        by_node.setdefault(k, {"calls": 0, "usd": 0.0})
        by_node[k]["calls"] += 1
        by_node[k]["usd"] = round(by_node[k]["usd"] + (r.get("cost_usd_est") or 0), 6)
    return {"calls": len(rows), "usd": round(sum(r.get("cost_usd_est") or 0 for r in rows), 6), "by_node": by_node,
            "failovers": sum(1 for r in rows if r.get("outcome") == "failover")}
