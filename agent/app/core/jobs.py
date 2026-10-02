"""Background jobs (agent_jobs): event ingestion and memory writes, serial per scope.

A job is leased, run, and marked done; a failure backs off and retries up to MAX_ATTEMPTS, then
goes 'dead' (kept for inspection, never silently dropped). Handlers must be idempotent: a crash
between the work and the 'done' mark runs the job again."""
import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core import db, locks
from app.core.log import error, warn
from app.core.runs import INSTANCE

MAX_ATTEMPTS = 5
LEASE = timedelta(minutes=5)
RENEW_EVERY = 30.0   # seconds: a running job keeps its lease and its scope lock alive
JOB_TIMEOUT = 600.0  # seconds: a hung handler gives its worker slot back
Handler = Callable[[dict], Awaitable[None]]

HANDLERS: dict[str, Handler] = {}
# Housekeeping run from the worker loop: [fn, every_s, last_run_monotonic].
PERIODIC: list[list] = []
# eventType -> function(payload, user_id, idea_id) -> list of (kind, scope_key, payload) jobs
EVENT_ROUTES: dict[str, Callable[[dict, str | None, str | None], list[tuple[str, str, dict]]]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def handler(kind: str):
    def wrap(fn: Handler) -> Handler:
        HANDLERS[kind] = fn
        return fn
    return wrap


def periodic(every_s: float):
    def wrap(fn):
        PERIODIC.append([fn, every_s, 0.0])
        return fn
    return wrap


def route_event(event_type: str):
    def wrap(fn):
        EVENT_ROUTES[event_type] = fn
        return fn
    return wrap


async def enqueue(kind: str, scope_key: str, *, user_id: str | None, payload: dict, idea_id: str | None = None,
                  dedupe_key: str | None = None, delay_s: float = 0) -> bool:
    doc = {
        "kind": kind, "scope_key": scope_key, "user_id": user_id, "idea_id": idea_id, "payload": payload,
        "status": "pending", "attempts": 0, "lease_until": None, "not_before": _now() + timedelta(seconds=delay_s),
        "created_at": _now(), "error": None,
    }
    if dedupe_key:
        doc["dedupe_key"] = dedupe_key
    try:
        await db.col("agent_jobs").insert_one(doc)
    except DuplicateKeyError:
        return False
    worker.wake()
    return True


async def enqueue_event(payload: dict, *, user_id: str | None, idea_id: str | None) -> bool:
    route = EVENT_ROUTES.get(payload.get("eventType", ""))
    if not route:
        await db.col("agent_events").update_one({"_id": payload.get("eventId")}, {"$set": {"status": "ignored"}})
        return False
    queued = False
    for i, (kind, scope_key, job_payload) in enumerate(route(payload, user_id, idea_id)):
        queued = await enqueue(kind, scope_key, user_id=user_id, idea_id=job_payload.get("idea_id") or idea_id, payload=job_payload,
                               dedupe_key=f"event:{payload['eventId']}:{i}") or queued
    return queued


class JobWorker:
    def __init__(self, concurrency: int = 4) -> None:
        self.concurrency = concurrency
        self._wake = asyncio.Event()
        self._busy: set[str] = set()
        self._tasks: set[asyncio.Task] = set()
        self._running: dict[object, tuple[asyncio.Task, dict]] = {}  # job id -> (task, job)
        self._loop_task: asyncio.Task | None = None
        self._stopping = False

    def wake(self) -> None:
        self._wake.set()

    def start(self) -> None:
        self._stopping = False
        self._loop_task = asyncio.create_task(self._loop(), name="job-worker")

    async def stop(self) -> None:
        self._stopping = True
        self.wake()
        if self._loop_task:
            self._loop_task.cancel()
            await asyncio.gather(self._loop_task, return_exceptions=True)
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _loop(self) -> None:
        while not self._stopping:
            try:
                await self.tick()
                await self.run_periodic()
            except Exception as e:  # noqa: BLE001 - the loop must survive; the error is logged
                error("jobs.loop_error", error=type(e).__name__, detail=str(e)[:300])
            self._wake.clear()
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=1.0)
            except TimeoutError:
                pass

    async def run_periodic(self) -> None:
        loop = asyncio.get_running_loop()
        for entry in PERIODIC:
            fn, every, last = entry
            if loop.time() - last >= every:
                entry[2] = loop.time()
                await fn()

    async def tick(self) -> int:
        """Start as many runnable jobs as capacity allows. Returns how many started."""
        started = 0
        now = _now()
        query = {"$or": [
            {"status": "pending", "not_before": {"$lte": now}},
            {"status": "leased", "lease_until": {"$lt": now}},  # a crashed worker's lease
        ]}
        async for job in db.col("agent_jobs").find(query).sort("created_at", 1).limit(100):
            if len(self._tasks) >= self.concurrency:
                break
            if job["scope_key"] in self._busy:
                continue
            leased = await db.col("agent_jobs").find_one_and_update(
                {"_id": job["_id"], "status": job["status"], "attempts": job["attempts"]},
                {"$set": {"status": "leased", "lease_until": now + LEASE, "lease_owner": INSTANCE}, "$inc": {"attempts": 1}},
                return_document=ReturnDocument.AFTER,
            )
            if not leased:
                continue
            if not await locks.acquire(job["scope_key"], INSTANCE, user_id=job.get("user_id"), idea_id=job.get("idea_id")):
                await db.col("agent_jobs").update_one({"_id": job["_id"]}, {"$set": {"status": "pending"}, "$inc": {"attempts": -1}})
                continue
            self._busy.add(job["scope_key"])
            task = asyncio.create_task(self._run(leased))
            self._tasks.add(task)
            self._running[leased["_id"]] = (task, leased)
            task.add_done_callback(self._tasks.discard)
            task.add_done_callback(lambda _t, jid=leased["_id"]: self._running.pop(jid, None))
            started += 1
        return started

    async def _run(self, job: dict) -> None:
        scope = job["scope_key"]
        jobs = db.col("agent_jobs")
        mine = {"_id": job["_id"], "status": "leased", "lease_owner": INSTANCE}  # never resurrect a cancelled job
        renew = asyncio.create_task(self._renew(job), name=f"renew:{job['_id']}")
        try:
            fn = HANDLERS.get(job["kind"])
            if fn is None:
                raise LookupError(f"no handler for job kind {job['kind']}")
            async with asyncio.timeout(JOB_TIMEOUT):
                await fn(job)
            await jobs.update_one(mine, {"$set": {"status": "done", "finished_at": _now()}})
        except asyncio.CancelledError:
            raise  # erase or shutdown: the job's status was already decided
        except Exception as e:  # noqa: BLE001 - recorded on the job and retried, never dropped
            dead = job["attempts"] >= MAX_ATTEMPTS
            (error if dead else warn)("jobs.failed", job=str(job["_id"]), kind=job["kind"], attempts=job["attempts"], error=type(e).__name__, detail=str(e)[:300])
            await jobs.update_one(mine, {"$set": {
                "status": "dead" if dead else "pending",
                "not_before": _now() + timedelta(seconds=min(300, 2 ** job["attempts"])),
                "error": f"{type(e).__name__}: {str(e)[:300]}",
            }})
        finally:
            renew.cancel()
            self._busy.discard(scope)  # first, so a failing release can't wedge the scope
            try:
                await locks.release(scope, INSTANCE)
            finally:
                self.wake()

    async def _renew(self, job: dict) -> None:
        """Keeps a long job's lease and scope lock from expiring under it (another worker would
        take the job, or the scope, and run it twice)."""
        while True:
            await asyncio.sleep(RENEW_EVERY)
            await db.col("agent_jobs").update_one({"_id": job["_id"], "status": "leased", "lease_owner": INSTANCE},
                                                  {"$set": {"lease_until": _now() + LEASE}})
            await locks.acquire(job["scope_key"], INSTANCE)

    async def cancel_matching(self, *, user_id: str | None = None, idea_ids: list[str] | None = None) -> int:
        """Erase (P16): cancel every queued job for this user or these ideas, then stop and wait
        for the ones running here, so none of them writes after the data is deleted."""
        query = {"user_id": user_id} if user_id else {"idea_id": {"$in": idea_ids or []}}
        await db.col("agent_jobs").update_many({**query, "status": {"$in": ["pending", "leased"]}}, {"$set": {"status": "cancelled"}})
        hits = [task for task, job in list(self._running.values())
                if (user_id and job.get("user_id") == user_id) or (idea_ids and job.get("idea_id") in idea_ids)]
        for task in hits:
            task.cancel()
        await asyncio.gather(*hits, return_exceptions=True)
        return len(hits)

    async def drain(self, timeout: float = 30.0) -> None:
        """Tests: run until nothing is runnable now."""
        loop = asyncio.get_running_loop()
        end = loop.time() + timeout
        while loop.time() < end:
            await self.tick()
            if self._tasks:
                await asyncio.gather(*list(self._tasks), return_exceptions=True)
                continue
            # The background loop may have leased a job and not yet registered its task: wait for
            # the database, not just our own task set.
            busy = await db.col("agent_jobs").count_documents({"$or": [
                {"status": "leased"}, {"status": "pending", "not_before": {"$lte": _now()}}]})
            if not busy:
                return
            await asyncio.sleep(0.02)
        warn("jobs.drain_timeout")


worker = JobWorker()


KEEP_FINISHED = timedelta(days=30)


@periodic(6 * 3600)
async def prune_finished() -> int:
    """Finished runs (with their checkpoints) and finished jobs are kept 30 days for inspection,
    then removed: every memory candidate makes a run, so these would otherwise only grow."""
    cutoff = _now() - KEEP_FINISHED
    pruned = 0
    async for run in db.col("agent_runs").find({"status": {"$in": ["complete", "failed", "cancelled"]}, "finished_at": {"$lt": cutoff}},
                                               {"thread_id": 1}).limit(500):
        await db.db()["agent_checkpoints"].delete_many({"thread_id": run["thread_id"]})
        await db.db()["agent_checkpoint_writes"].delete_many({"thread_id": run["thread_id"]})
        await db.col("agent_runs").delete_one({"_id": run["_id"]})
        pruned += 1
    await db.col("agent_jobs").delete_many({"status": {"$in": ["done", "cancelled"]}, "created_at": {"$lt": cutoff}})
    return pruned
