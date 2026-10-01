"""The HTTP surface Node calls: service key, SSE replay, events dedupe, erase, health."""
import asyncio

from tests.conftest import SERVICE, as_user


async def test_service_key_required(app_client):
    assert (await app_client.get("/internal/health")).status_code == 401
    assert (await app_client.get("/internal/health", headers={"X-Agent-Key": "wrong"})).status_code == 401
    res = await app_client.get("/internal/health", headers=SERVICE)
    assert res.status_code == 200
    body = res.json()
    assert body["mongo"] == "up" and body["checkpoints"] == "up" and body["fakeLlm"] is True
    assert set(body["providers"]) == {"anthropic", "groq", "cerebras", "sambanova", "google"}


def _parse(raw: str) -> list[dict]:
    import json
    out = []
    for frame in raw.strip().split("\n\n"):
        ev = {}
        for line in frame.split("\n"):
            if line.startswith(":"):
                continue
            k, _, v = line.partition(": ")
            ev[k] = v
        if ev:
            out.append({"id": int(ev["id"]), "event": ev["event"], "data": json.loads(ev["data"])})
    return out


async def test_echo_stream_resume_and_replay(app_client):
    res = await app_client.post("/internal/diagnostics/echo", json={"message": "hello"}, headers=as_user("u1"))
    run_id = res.json()["runId"]
    first = _parse((await app_client.get(f"/internal/diagnostics/echo/{run_id}/stream", headers=as_user("u1"))).text)
    assert [e["event"] for e in first] == ["progress", "echo", "interrupt"]
    assert first[-1]["data"] == {"v": 1, "kind": "echo", "message": "hello"}

    assert (await app_client.post(f"/internal/diagnostics/echo/{run_id}/resume", json={"reply": "yo"}, headers=as_user("u1"))).status_code == 200
    rest = _parse((await app_client.get(f"/internal/diagnostics/echo/{run_id}/stream?after={first[-1]['id']}", headers=as_user("u1"))).text)
    assert [e["event"] for e in rest] == ["progress", "echo", "complete"]
    assert rest[0]["id"] == first[-1]["id"] + 1


async def test_someone_elses_run_is_404(app_client):
    run_id = (await app_client.post("/internal/diagnostics/echo", json={"message": "mine"}, headers=as_user("u1"))).json()["runId"]
    assert (await app_client.get(f"/internal/diagnostics/echo/{run_id}/stream", headers=as_user("u2"))).status_code == 404
    assert (await app_client.post(f"/internal/diagnostics/echo/{run_id}/resume", json={"reply": "x"}, headers=as_user("u2"))).status_code == 404


async def test_events_are_stored_once(app_client):
    from app.core import db
    ev = {"eventType": "idea.updated", "eventId": "e-1", "ideaId": "i1", "changes": {"title": "x"}}
    first = await app_client.post("/internal/events", json=ev, headers=SERVICE)
    again = await app_client.post("/internal/events", json=ev, headers=SERVICE)
    assert first.status_code == 202 and again.json()["status"] == "duplicate"
    assert await db.col("agent_events").count_documents({"_id": "e-1"}) == 1
    ours = await app_client.post("/internal/events", json={**ev, "eventId": "e-2", "source": "agent"}, headers=SERVICE)
    assert ours.json()["status"] == "ignored"


async def test_erase_cancels_running_work(app_client):
    from app.core import db
    run_id = (await app_client.post("/internal/diagnostics/echo", json={"message": "bye"}, headers=as_user("u9"))).json()["runId"]
    for _ in range(50):
        if (await db.col("agent_runs").find_one({"_id": run_id}))["status"] == "interrupted":
            break
        await asyncio.sleep(0.05)
    res = await app_client.post("/internal/erase", json={"userId": "u9"}, headers=SERVICE)
    assert res.json()["cancelled"] == 1
    assert (await db.col("agent_runs").find_one({"_id": run_id}))["status"] == "cancelled"
