"""RunManager: runs a graph as a background task, separate from any HTTP request.

RabbitHole ran the graph inside the SSE request, so closing the tab killed the run. Here:
  - every event a run produces is numbered (seq) and stored in agent_run_events;
  - a client subscribes with ?after=<seq>, gets the stored events it missed, then live ones;
  - an interrupted run (waiting for the founder) is resumed with Command(resume=...);
  - runs a stopped or dead process left behind are driven again from their Mongo checkpoint: a
    graceful shutdown releases its runs at once; a crashed instance's runs are claimed once their
    heartbeat (every HEARTBEAT s while a run is driven) is STALE s old. Claims are atomic, so two
    instances never drive one run.
Live delivery is in-process; subscribers also poll Mongo every 2 s, so several instances work.
"""
import asyncio
import os
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import datetime, timedelta, timezone

from langgraph.types import Command
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core import db
from app.core.errors import AgentError, NotFound
from app.core.log import error, log

TERMINAL = {"interrupt", "complete", "error"}
ACTIVE = ["queued", "running"]
INSTANCE = f"{os.getpid()}-{uuid.uuid4().hex[:6]}"
PING = {"type": "ping"}
HEARTBEAT = 20.0  # seconds between heartbeats while a run is driven
STALE = 90.0      # a heartbeat this old means the instance driving the run is gone
CANCELLED = {"code": "cancelled", "message": "This was stopped.", "retryable": False}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RunManager:
    def __init__(self) -> None:
        self.graphs: dict[str, object] = {}
        self.finishers: dict[str, Callable[[dict, dict], Awaitable[None]]] = {}
        self.durability: dict[str, str] = {}
        self.tasks: dict[str, asyncio.Task] = {}
        self.subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # Runs this process stops without ending them (shutdown, or another instance took over):
        # their status stays as it is, so they are driven again from the checkpoint.
        self._released: set[str] = set()
        self._emit_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._seqs: dict[str, int] = {}  # each run's last event number, while it's driven here
        self._recovery: asyncio.Task | None = None

    def register(self, kind: str, graph, on_finish: Callable[[dict, dict], Awaitable[None]] | None = None,
                 durability: str | None = None) -> None:
        """`on_finish(run, final_state_values)` runs after the graph ends (complete or failed), not on interrupts.
        `durability="exit"` checkpoints only when the run ends or pauses (a short graph with an
        idempotent commit: ~25 checkpoint writes become ~4). Its input is kept on the run, so a run
        that dies before its first checkpoint starts over instead of failing."""
        self.graphs[kind] = graph
        if on_finish:
            self.finishers[kind] = on_finish
        if durability:
            self.durability[kind] = durability

    # ---- events -------------------------------------------------------------------------
    async def emit(self, run_id: str, user_id: str | None, type_: str, data: dict, idea_id: str | None = None) -> int:
        # One emit at a time per run (parallel nodes emit together): numbering, storing and
        # delivering in one step keeps events in seq order, so a subscriber never skips one.
        # The number is kept here (only the driving instance emits) and the unique (run_id, seq)
        # index guards it: one insert per event instead of a counter update plus an insert.
        async with self._emit_locks[run_id]:
            for attempt in range(3):
                seq = await self._next_seq(run_id)
                ev = {"run_id": run_id, "user_id": user_id, "idea_id": idea_id, "seq": seq, "type": type_, "data": data, "at": _now()}
                try:
                    await db.col("agent_run_events").insert_one(dict(ev))
                    break
                except DuplicateKeyError:
                    self._seqs.pop(run_id, None)  # someone else numbered events for it: re-read
                    if attempt == 2:
                        raise
            for q in list(self.subs.get(run_id, ())):
                q.put_nowait(ev)
            return ev["seq"]

    async def _next_seq(self, run_id: str) -> int:
        if run_id not in self._seqs:
            last = await db.col("agent_run_events").find_one({"run_id": run_id}, {"seq": 1}, sort=[("seq", -1)])
            self._seqs[run_id] = int((last or {}).get("seq") or 0)
        self._seqs[run_id] += 1
        return self._seqs[run_id]

    async def last_seq(self, run_id: str) -> int:
        """The newest event's number (0 when there are none, or they expired)."""
        last = await db.col("agent_run_events").find_one({"run_id": run_id}, {"seq": 1}, sort=[("seq", -1)])
        return int((last or {}).get("seq") or 0)

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
                    # Driven here: every event reaches the queue, so there's nothing to poll for.
                    # Driven elsewhere (another instance), Mongo is the only way to see them.
                    driven_here = run_id in self.tasks
                    batch = [] if driven_here else [
                        e async for e in db.col("agent_run_events").find({"run_id": run_id, "seq": {"$gt": last}}).sort("seq", 1)]
                    if not batch:
                        # Nothing new and the run isn't going anywhere (finished, waiting, stopped,
                        # deleted): end the stream instead of polling forever.
                        if not driven_here:
                            run = await db.col("agent_runs").find_one({"_id": run_id}, {"status": 1})
                            if not run or run["status"] not in ACTIVE:
                                return
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
            "status": "queued", "owner": INSTANCE, "heartbeat_at": _now(), "started_at": _now(),
            "finished_at": None, "error": None, **(meta or {}),
            # Kept only where checkpoints are written at the end (see register): the restart point.
            **({"input": input} if self.durability.get(kind) == "exit" else {}),
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
        """Stops a run for good (the founder deleted it, or erase): it ends with an error event."""
        stopped = await db.col("agent_runs").update_one(
            {"_id": run_id, "status": {"$in": [*ACTIVE, "interrupted"]}},
            {"$set": {"status": "cancelled", "finished_at": _now()}},
        )
        task = self.tasks.pop(run_id, None)
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)  # nothing it does lands after this
        if stopped.modified_count:
            run = await db.col("agent_runs").find_one({"_id": run_id}, {"user_id": 1, "idea_id": 1})
            if run:
                await self.emit(run_id, run.get("user_id"), "error", CANCELLED, idea_id=run.get("idea_id"))

    async def cancel_matching(self, query: dict) -> int:
        n = 0
        async for run in db.col("agent_runs").find({**query, "status": {"$in": ["queued", "running", "interrupted"]}}, {"_id": 1}):
            await self.cancel(run["_id"])
            n += 1
        return n

    async def recover(self) -> int:
        """Claim and drive runs nobody is driving: released by a graceful shutdown (no owner), or
        left by a dead instance (heartbeat STALE s old). The claim is one conditional write, so
        two instances can't both take a run."""
        runs = db.col("agent_runs")
        stale = _now() - timedelta(seconds=STALE)
        orphaned = {"status": {"$in": ACTIVE}, "kind": {"$in": list(self.graphs)},
                    "$or": [{"owner": None}, {"owner": {"$ne": INSTANCE}, "heartbeat_at": {"$lt": stale}}]}
        n = 0
        async for found in runs.find(orphaned, {"_id": 1}):
            run = await runs.find_one_and_update(
                {"_id": found["_id"], **orphaned}, {"$set": {"owner": INSTANCE, "heartbeat_at": _now()}},
                return_document=ReturnDocument.AFTER,
            )
            if run and run["_id"] not in self.tasks:
                self._spawn(run, None)
                n += 1
        if n:
            log("runs.recovered", count=n)
        return n

    def start_recovery(self, every: float = 60.0) -> None:
        """Keep claiming orphaned runs while the service is up (a crashed instance's runs)."""
        async def loop() -> None:
            while True:
                await asyncio.sleep(every)
                try:
                    await self.recover()
                except Exception as e:  # noqa: BLE001 - logged; the next pass tries again
                    error("runs.recover_failed", error=type(e).__name__)
        if not self._recovery:
            self._recovery = asyncio.create_task(loop(), name="runs:recovery")

    async def wait(self, run_id: str) -> None:
        task = self.tasks.get(run_id)
        if task:
            await asyncio.shield(task)

    async def shutdown(self) -> None:
        """Stop driving without ending anything: runs are released for the next process."""
        if self._recovery:
            self._recovery.cancel()
            self._recovery = None
        self._released.update(self.tasks)
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
        beat = asyncio.create_task(self._heartbeat(run_id, asyncio.current_task()), name=f"beat:{run_id}")
        durability = self.durability.get(run["kind"])
        try:
            if payload is None and durability == "exit" and run.get("input") is not None:
                # Recovered: without a checkpoint (it died before ending or pausing), start over.
                if not (await graph.aget_state(config)).values:
                    payload = run["input"]
            # Liveness is the heartbeat task's job (every HEARTBEAT s), not a write per graph step.
            async for _update in graph.astream(payload, config, stream_mode="updates", durability=durability):
                pass
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
            if run_id in self._released:
                # Shutdown or lost ownership: leave the status, give up the claim, so the run is
                # driven again from its checkpoint (by the next process, or the new owner).
                self._released.discard(run_id)
                await runs.update_one({"_id": run_id, "owner": INSTANCE}, {"$set": {"owner": None}})
            raise
        except Exception as e:  # noqa: BLE001 - surfaced as an error event and logged, never swallowed
            public = e.public() if isinstance(e, AgentError) else AgentError().public()
            error("run.crashed", run_id=run_id, kind=run["kind"], error=type(e).__name__, code=public["code"], detail=str(e)[:300])
            await runs.update_one({"_id": run_id}, {"$set": {"status": "failed", "finished_at": _now(), "error": public}})
            # The finisher runs on this path too (a review still records the failure and refunds).
            finisher = self.finishers.get(run["kind"])
            if finisher:
                try:
                    await finisher(run, {"status": "failed", "error": public})
                except Exception as fe:  # noqa: BLE001 - logged; the run already failed
                    error("run.finisher_failed", run_id=run_id, error=type(fe).__name__)
            await emit("error", public)
        finally:
            beat.cancel()
            self._seqs.pop(run_id, None)
            self._emit_locks.pop(run_id, None)

    async def _heartbeat(self, run_id: str, driver: asyncio.Task | None) -> None:
        """Proves this instance still drives the run. If another instance took it over (this one
        stalled past STALE) or it was cancelled elsewhere (erase), stop driving without touching it."""
        while True:
            await asyncio.sleep(HEARTBEAT)
            mine = await db.col("agent_runs").update_one({"_id": run_id, "owner": INSTANCE, "status": {"$in": ACTIVE}},
                                                         {"$set": {"heartbeat_at": _now()}})
            if not mine.matched_count and driver:
                self._released.add(run_id)
                driver.cancel()
                return


manager = RunManager()
