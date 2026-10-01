"""Run the evals.

  cd agent
  .venv/bin/python -m evals.run_eval all                      # fake models: free, checks the harness
  EVAL_CONFIRM_SPEND=yes .venv/bin/python -m evals.run_eval memory_judge --replicates 3
  EVAL_CONFIRM_SPEND=yes .venv/bin/python -m evals.run_eval nothing --limit 5

With real models (AGENT_FAKE_LLM=false in agent/.env) every suite costs money, so it refuses to run
unless EVAL_CONFIRM_SPEND=yes. It uses its own database (agent_eval on the same server, or
EVAL_MONGO_URI), wiped at the start, and a stand-in for Node, so it never touches real users.
Reports go to evals/results/<time>-<suite>.json with accuracy, κ, confusions and the cost."""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ESTIMATE_USD = {"memory_judge": 0.002, "nothing": 0.15, "rebuttal": 0.02, "supersession": 0.004, "perturb": 0.15}


def eval_uri(uri: str) -> str:
    parts = urlsplit(uri)
    return urlunsplit((parts.scheme, parts.netloc, "/agent_eval", parts.query, parts.fragment))


async def run(names: list[str], limit: int | None, replicates: int, out_dir: Path) -> dict:
    from app.core import checkpointer, db, node_client
    from app.core.runs import manager
    from app.memory import fakes as _mf  # noqa: F401
    from app.memory.graph.builder import compile_memory_write
    from app.review import fakes as _rf  # noqa: F401
    from evals import suites
    from tests.fakes.node_server import FakeNode

    await db.ensure_indexes()
    for name in list(db.INDEXES) + list(db.CHECKPOINT_COLLECTIONS):
        await db.db()[name].delete_many({})
    node = FakeNode(key=None)
    node_client.set_transport(node.transport())
    manager.register("memory_write", compile_memory_write(checkpointer.saver()))

    reports = {}
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    for name in names:
        start = datetime.now(timezone.utc)
        kwargs = {"limit": limit, "replicates": replicates}
        if name == "supersession":
            kwargs["node"] = node
        report = await suites.SUITES[name](**kwargs)
        report["cost"] = await suites.cost_since(start)
        report["suite"], report["at"] = name, start.isoformat()
        (out_dir / f"{stamp}-{name}.json").write_text(json.dumps(report, indent=1, ensure_ascii=False, default=str))
        reports[name] = report
    await manager.shutdown()
    await node_client.close()
    await db.close()
    checkpointer.close()
    return reports


def summary(name: str, r: dict) -> str:
    keys = [k for k in ("accuracy_combined", "kappa_combined", "ab_ba_consistency", "label_in_allowed", "must_flag_recall",
                        "never_violations", "outcome_accuracy", "wrongly_resolved", "pass_rate", "op_accuracy",
                        "total_violations", "injection_flagged", "replicate_agreement") if k in r and r[k] is not None]
    return f"{name:13} " + "  ".join(f"{k}={r[k]}" for k in keys) + f"  cost=${r['cost']['usd']}"


def main() -> int:
    from evals.suites import SUITES  # noqa: F401 - fail fast on a broken suite import
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("suite", choices=["all", *ESTIMATE_USD])
    p.add_argument("--limit", type=int, default=None, help="only the first N items per suite")
    p.add_argument("--replicates", type=int, default=1, help="run each item N times (agreement between runs)")
    p.add_argument("--out", default=str(Path(__file__).parent / "results"))
    a = p.parse_args()

    from app.core.settings import get_settings
    s = get_settings()
    names = list(ESTIMATE_USD) if a.suite == "all" else [a.suite]
    if not s.agent_fake_llm:
        if os.environ.get("EVAL_CONFIRM_SPEND") != "yes":
            print("These evals call real models and cost money. Re-run with EVAL_CONFIRM_SPEND=yes.", file=sys.stderr)
            return 2
    s.mongo_uri = os.environ.get("EVAL_MONGO_URI") or eval_uri(s.mongo_uri)
    print(f"evals on {'fake' if s.agent_fake_llm else 'real'} models, database {urlsplit(s.mongo_uri).path.lstrip('/')}")
    reports = asyncio.run(run(names, a.limit, a.replicates, Path(a.out)))
    for name, r in reports.items():
        print(summary(name, r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
