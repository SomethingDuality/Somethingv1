"""RunManager + durable checkpoints, on the Phase A echo graph. These are the regressions for
RabbitHole's flaws: runs survive a restart, errors surface, progress arrives in order."""
from app.core import checkpointer, db
from app.core.runs import RunManager
from app.diagnostics.graph.builder import compile_echo


async def _events(run_id: str) -> list[tuple[str, dict]]:
    return [(e["type"], e["data"]) async for e in db.col("agent_run_events").find({"run_id": run_id}).sort("seq", 1)]


async def test_echo_pauses_then_resumes():
    m = RunManager()
    m.register("echo", compile_echo(checkpointer.saver()))
    run = await m.start("echo", thread_id="u:u1:t:echo:r1", user_id="u1", input={"message": "hello"}, run_id="r1")
    await m.wait("r1")
    types = [t for t, _ in await _events("r1")]
    assert types == ["progress", "echo", "interrupt"]
    assert (await db.col("agent_runs").find_one({"_id": run["_id"]}))["status"] == "interrupted"

    await m.resume("r1", "hi back")
    await m.wait("r1")
    evs = await _events("r1")
    assert [t for t, _ in evs][3:] == ["progress", "echo", "complete"]
    assert evs[4][1] == {"message": "hello", "reply": "hi back"}
    assert [e["seq"] async for e in db.col("agent_run_events").find({"run_id": "r1"}).sort("seq", 1)] == list(range(1, 7))


async def test_paused_run_survives_a_restart():
    first = RunManager()
    first.register("echo", compile_echo(checkpointer.saver()))
    await first.start("echo", thread_id="u:u1:t:echo:r2", user_id="u1", input={"message": "keep me"}, run_id="r2")
    await first.wait("r2")
    checkpointer.close()  # the process "dies": new Mongo client, new saver, new graph

    second = RunManager()
    second.register("echo", compile_echo(checkpointer.saver()))
    await second.resume("r2", "after restart")
    await second.wait("r2")
    evs = await _events("r2")
    assert evs[-1][0] == "complete"
    assert evs[-2][1] == {"message": "keep me", "reply": "after restart"}


async def test_node_errors_surface_as_error_events():
    m = RunManager()
    m.register("echo", compile_echo(checkpointer.saver()))
    await m.start("echo", thread_id="u:u1:t:echo:r3", user_id="u1", input={"message": "x", "explode_at": "ping"}, run_id="r3")
    await m.wait("r3")
    evs = await _events("r3")
    assert evs[-1][0] == "error"
    assert evs[-1][1]["code"] == "internal" and evs[-1][1]["node"] == "ping_node"
    assert "Traceback" not in str(evs)  # no traces leave the service
    assert (await db.col("agent_runs").find_one({"_id": "r3"}))["status"] == "failed"


async def test_subscribe_replays_then_follows_live():
    m = RunManager()
    m.register("echo", compile_echo(checkpointer.saver()))
    await m.start("echo", thread_id="u:u1:t:echo:r4", user_id="u1", input={"message": "s"}, run_id="r4")
    await m.wait("r4")
    seen = [e["type"] async for e in m.subscribe("r4", after=1)]
    assert seen == ["echo", "interrupt"]  # replay from seq 2, stops at the terminal event

    async def resume_later():
        await m.resume("r4", "ok")
    import asyncio
    task = asyncio.create_task(resume_later())
    seen = [e["type"] async for e in m.subscribe("r4", after=3)]
    await task
    assert seen == ["progress", "echo", "complete"]


async def test_recover_drives_runs_left_running():
    from datetime import datetime, timedelta, timezone
    m = RunManager()
    m.register("echo", compile_echo(checkpointer.saver()))
    old = datetime.now(timezone.utc) - timedelta(minutes=5)
    await db.col("agent_runs").insert_one({
        "_id": "r5", "thread_id": "u:u1:t:echo:r5", "kind": "echo", "user_id": "u1", "status": "queued",
        "seq": 0, "owner": "dead-process", "heartbeat_at": old, "started_at": old,
    })
    # A queued run whose process died before starting has no checkpoint: recover drives it from
    # scratch only when the input is known, so here it simply reaches the end with nothing to do.
    assert await m.recover() == 1
    await m.wait("r5")
    assert (await db.col("agent_runs").find_one({"_id": "r5"}))["status"] in ("complete", "failed")


async def test_a_live_instances_run_is_never_taken():
    from datetime import datetime, timezone
    m = RunManager()
    m.register("echo", compile_echo(checkpointer.saver()))
    now = datetime.now(timezone.utc)
    await db.col("agent_runs").insert_one({
        "_id": "r6", "thread_id": "u:u1:t:echo:r6", "kind": "echo", "user_id": "u1", "status": "running",
        "seq": 0, "owner": "live-process", "heartbeat_at": now, "started_at": now,
    })
    assert await m.recover() == 0
    assert (await db.col("agent_runs").find_one({"_id": "r6"}))["owner"] == "live-process"


async def test_shutdown_releases_runs_for_the_next_process():
    import asyncio

    from app.core import runs as runs_mod
    first = RunManager()
    first.register("echo", compile_echo(checkpointer.saver()))
    gate = asyncio.Event()
    real_emit = first.emit

    async def slow_emit(*a, **k):  # hold the run mid-graph, as a long model call would
        await gate.wait()
        return await real_emit(*a, **k)
    first.emit = slow_emit
    await first.start("echo", thread_id="u:u1:t:echo:r7", user_id="u1", input={"message": "keep going"}, run_id="r7")
    await asyncio.sleep(0.1)
    await first.shutdown()
    run = await db.col("agent_runs").find_one({"_id": "r7"})
    assert run["status"] in ("queued", "running") and run["owner"] is None, run

    this_process, runs_mod.INSTANCE = runs_mod.INSTANCE, "next-process"
    try:
        second = RunManager()
        second.register("echo", compile_echo(checkpointer.saver()))
        assert await second.recover() == 1
        await second.wait("r7")
        assert (await db.col("agent_runs").find_one({"_id": "r7"}))["status"] == "interrupted"
    finally:
        runs_mod.INSTANCE = this_process
        gate.set()


async def test_parallel_emits_arrive_in_order():
    import asyncio
    m = RunManager()
    await db.col("agent_runs").insert_one({"_id": "r8", "thread_id": "t", "kind": "echo", "user_id": "u1", "status": "running", "seq": 0})
    seen: list[int] = []

    async def listen():
        async for ev in m.subscribe("r8"):
            seen.append(ev["seq"])
            if len(seen) == 20:
                return
    listener = asyncio.create_task(listen())
    await asyncio.sleep(0.05)
    await asyncio.gather(*[m.emit("r8", "u1", "progress", {"i": i}) for i in range(20)])
    await asyncio.wait_for(listener, 5)
    assert seen == list(range(1, 21))


async def test_a_stream_on_a_stopped_run_ends():
    import asyncio
    m = RunManager()
    await db.col("agent_runs").insert_one({"_id": "r9", "thread_id": "t", "kind": "echo", "user_id": "u1", "status": "cancelled", "seq": 0})
    got = await asyncio.wait_for(_collect(m.subscribe("r9")), 5)
    assert got == []


async def _collect(it):
    return [e async for e in it]
