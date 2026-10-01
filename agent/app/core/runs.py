"""RunManager: runs a graph as a background task, separate from any HTTP request.

RabbitHole ran the graph inside the SSE request, so closing the tab killed the run. Here:
  - every event a run produces is numbered (seq) and stored in agent_run_events;
  - a client subscribes with ?after=<seq>, gets the stored events it missed, then live ones;
  - an interrupted run (waiting for the founder) is resumed with Command(resume=...);
  - on boot, runs left 'running' by a dead process are driven again from their Mongo checkpoint.
Live delivery is in-process; subscribers also poll Mongo every 2 s, so several instances work.
"""
import asyncio
import os
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import datetime, timezone

from langgraph.types import Command
from pymongo import ReturnDocument

from app.core import db
from app.core.errors import AgentError, NotFound
from app.core.log import error, log

TERMINAL = {"interrupt", "complete", "error"}
INSTANCE = f"{os.getpid()}-{uuid.uuid4().hex[:6]}"
PING = {"type": "ping"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RunManager:
    def __init__(self) -> None:
        self.graphs: dict[str, object] = {}
        self.finishers: dict[str, Callable[[dict, dict], Awaitable[None]]] = {}
        self.tasks: dict[str, asyncio.Task] = {}
        self.subs: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def register(self, kind: str, graph, on_finish: Callable[[dict, dict], Awaitable[None]] | None = None) -> None:
        """`on_finish(run, final_state_values)` runs after the graph ends (complete or failed), not on interrupts."""
        self.graphs[kind] = graph
        if on_finish:
            self.finishers[kind] = on_finish

    # ---- events -------------------------------------------------------------------------
    async def emit(self, run_id: str, user_id: str | None, type_: str, data: dict, idea_id: str | None = None) -> int:
        run = await db.col("agent_runs").find_one_and_update(
            {"_id": run_id}, {"$inc": {"seq": 1}, "$set": {"heartbeat_at": _now()}},
            projection={"seq": 1}, return_document=ReturnDocument.AFTER,
        )
        if not run:
            raise NotFound(f"run {run_id}")
        ev = {"run_id": run_id, "user_id": user_id, "idea_id": idea_id, "seq": run["seq"], "type": type_, "data": data, "at": _now()}
        await db.col("agent_run_events").insert_one(dict(ev))
        for q in list(self.subs.get(run_id, ())):
            q.put_nowait(ev)
        return ev["seq"]

    async def subscribe(self, run_id: str, after: int = 0, ping_every: float = 15.0) -> AsyncIterator[dict]:
        """Stored events after `after`, then live ones. Ends after a terminal event."""
        q: asyncio.Queue = asyncio.Queue()
        self.subs[run_id].add(q)  # subscribe before replaying, so nothing falls in between
        last, idle = after, 0.0
        try:
            async for ev in db.col("agent_run_events").find({"run_id": run_id, "seq": {"$gt": after}}).sort("seq", 1):
                last = ev["seq"]
                yield ev
                if ev["type"] in TERMINAL:
                    return
            while True:
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=2.0)
                    batch = [ev]
                except TimeoutError:
                    batch = [e async for e in db.col("agent_run_events").find({"run_id": run_id, "seq": {"$gt": last}}).sort("seq", 1)]
                    if not batch:
                        idle += 2.0
                        if idle >= ping_every:
                            idle = 0.0
                            yield PING
                        continue
                idle = 0.0
                for ev in batch:
                    if ev["seq"] <= last:
                        continue
                    last = ev["seq"]
                    yield ev
                    if ev["type"] in TERMINAL:
                        return
        finally:
            self.subs[run_id].discard(q)
            if not self.subs[run_id]:
                self.subs.pop(run_id, None)

    # ---- lifecycle ----------------------------------------------------------------------
    async def start(self, kind: str, *, thread_id: str, user_id: str, input: dict, idea_id: str | None = None,
                    run_id: str | None = None, meta: dict | None = None) -> dict:
        run_id = run_id or uuid.uuid4().hex
        run = {
            "_id": run_id, "thread_id": thread_id, "kind": kind, "user_id": user_id, "idea_id": idea_id,
            "status": "queued", "seq": 0, "owner": INSTANCE, "heartbeat_at": _now(), "started_at": _now(),
            "finished_at": None, "error": None, **(meta or {}),
        }
        await db.col("agent_runs").insert_one(run)
        self._spawn(run, input)
        return run

    async def resume(self, run_id: str, value) -> dict:
        run = await db.col("agent_runs").find_one_and_update(
            {"_id": run_id, "status": "interrupted"},
            {"$set": {"status": "queued", "owner": INSTANCE, "heartbeat_at": _now()}},
            return_document=ReturnDocument.AFTER,
        )
        if not run:
            raise NotFound(f"run {run_id} is not waiting")
        self._spawn(run, Command(resume=value))
        return run

    async def cancel(self, run_id: str) -> None:
        task = self.tasks.pop(run_id, None)
        if task:
            task.cancel()
        await db.col("agent_runs").update_one(
            {"_id": run_id, "status": {"$in": ["queued", "running", "interrupted"]}},
            {"$set": {"status": "cancelled", "finished_at": _now()}},
        )

    async def cancel_matching(self, query: dict) -> int:
        n = 0
        async for run in db.col("agent_runs").find({**query, "status": {"$in": ["queued", "running", "interrupted"]}}, {"_id": 1}):
            await self.cancel(run["_id"])
            n += 1
        return n

    async def recover(self) -> int:
        """Drive runs a dead process left behind, from their last checkpoint."""
        n = 0
        async for run in db.col("agent_runs").find({"status": {"$in": ["queued", "running"]}, "owner": {"$ne": INSTANCE}}):
            if run["kind"] not in self.graphs:
                continue
            await db.col("agent_runs").update_one({"_id": run["_id"]}, {"$set": {"owner": INSTANCE}})
            self._spawn(run, None)
            n += 1
        if n:
            log("runs.recovered", count=n)
        return n

    async def wait(self, run_id: str) -> None:
        task = self.tasks.get(run_id)
        if task:
            await asyncio.shield(task)

    async def shutdown(self) -> None:
        for task in list(self.tasks.values()):
            task.cancel()
        await asyncio.gather(*self.tasks.values(), return_exceptions=True)
        self.tasks.clear()

    # ---- driving ------------------------------------------------------------------------
    def _spawn(self, run: dict, payload) -> None:
        task = asyncio.create_task(self._drive(run, payload), name=f"run:{run['_id']}")
        self.tasks[run["_id"]] = task
        task.add_done_callback(lambda _t, rid=run["_id"]: self.tasks.pop(rid, None) if self.tasks.get(rid) is _t else None)

    async def _drive(self, run: dict, payload) -> None:
        run_id, user_id = run["_id"], run["user_id"]
        graph = self.graphs[run["kind"]]

        async def emit(type_: str, data: dict) -> None:
            await self.emit(run_id, user_id, type_, data, idea_id=run.get("idea_id"))

        config = {"configurable": {"thread_id": run["thread_id"], "emit": emit, "run_id": run_id, "user_id": user_id}}
        runs = db.col("agent_runs")
        await runs.update_one({"_id": run_id}, {"$set": {"status": "running", "heartbeat_at": _now()}})
        try:
            async for _update in graph.astream(payload, config, stream_mode="updates"):
                await runs.update_one({"_id": run_id}, {"$set": {"heartbeat_at": _now()}})
            state = await graph.aget_state(config)
            if state.interrupts:
                await runs.update_one({"_id": run_id}, {"$set": {"status": "interrupted"}})
                await emit("interrupt", state.interrupts[0].value)
                return
            values = state.values or {}
            finisher = self.finishers.get(run["kind"])
            if finisher:
                await finisher(run, values)
            if values.get("status") == "failed":
                err = values.get("error") or AgentError().public()
                await runs.update_one({"_id": run_id}, {"$set": {"status": "failed", "finished_at": _now(), "error": err}})
                await emit("error", err)
            else:
                await runs.update_one({"_id": run_id}, {"$set": {"status": "complete", "finished_at": _now()}})
                await emit("complete", {"runId": run_id, "status": values.get("status", "complete")})
        except asyncio.CancelledError:
            await runs.update_one({"_id": run_id, "status": {"$ne": "cancelled"}}, {"$set": {"status": "cancelled", "finished_at": _now()}})
            raise
        except AgentError as e:
            error("run.failed", run_id=run_id, kind=run["kind"], code=e.code, detail=e.detail)
            await runs.update_one({"_id": run_id}, {"$set": {"status": "failed", "finished_at": _now(), "error": e.public()}})
            await emit("error", e.public())
        except Exception as e:  # noqa: BLE001 - surfaced as an error event and logged, never swallowed
            error("run.crashed", run_id=run_id, kind=run["kind"], error=type(e).__name__, detail=str(e)[:300])
            public = AgentError().public()
            await runs.update_one({"_id": run_id}, {"$set": {"status": "failed", "finished_at": _now(), "error": public}})
            await emit("error", public)


manager = RunManager()
