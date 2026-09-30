"""The review HTTP surface Node calls: founders only, stream + replay, react, latest, delete,
and the flat error shape (quota, validation)."""
import asyncio

from app.core import db
from app.core.runs import manager
from tests.api.test_api import _parse
from tests.conftest import as_user

USER, IDEA = "65f000000000000000000001", "65f0000000000000000000aa"
TEXT = "Students in hostels have a problem with late night food. We build an app for hostel students to order food at night."


async def _setup(fake_node):
    fake_node.add_user(USER, "Founder")
    fake_node.add_idea(IDEA, USER, title="Late night meals", description=TEXT)


async def _wait_interrupted(rid):
    for _ in range(200):
        run = await db.col("agent_runs").find_one({"_id": rid})
        if run and run["status"] in ("interrupted", "complete", "failed"):
            return run["status"]
        await asyncio.sleep(0.02)
    raise AssertionError("run didn't pause")


async def test_review_over_http(app_client, fake_node):
    await _setup(fake_node)
    h = as_user(USER)
    assert (await app_client.post("/internal/reviews", json={"ideaId": IDEA}, headers=as_user(USER, "Investor"))).status_code == 403
    st = (await app_client.get("/internal/reviews/status", headers=h)).json()
    assert st["live"] is True and st["quota"]["used"] == 0

    start = (await app_client.post("/internal/reviews", json={"ideaId": IDEA, "readers": ["something", "nothing"]}, headers=h)).json()
    rid = start["reviewId"]
    assert start["kind"] == "review" and start["quota"]["used"] == 1
    assert await _wait_interrupted(rid) == "interrupted"

    frames = _parse((await app_client.get(f"/internal/reviews/{rid}/stream", headers=h)).text)
    assert frames[-1]["event"] == "interrupt" and frames[-1]["data"]["kind"] == "reaction"
    nothing = next(f["data"] for f in frames if f["event"] == "reader" and f["data"]["reader"] == "nothing")
    risk = nothing["risks"][0]["id"]

    got = (await app_client.get(f"/internal/reviews/{rid}", headers=h)).json()["review"]
    assert got["nothing"]["verdict"] == nothing["verdict"], "polling shows what the stream showed"
    assert (await app_client.get(f"/internal/reviews/{rid}", headers=as_user("65f0000000000000000000ff"))).status_code == 404

    assert (await app_client.post(f"/internal/reviews/{rid}/react", json={"kind": "accept"}, headers=h)).status_code == 422
    assert (await app_client.post(f"/internal/reviews/{rid}/react", json={"kind": "accept", "riskId": risk}, headers=h)).status_code == 200
    await manager.wait(rid)
    after = _parse((await app_client.get(f"/internal/reviews/{rid}/stream?after={frames[-1]['id']}", headers=h)).text)
    assert after[0]["event"] == "ruling" and after[0]["data"]["status"] == "accepted"

    latest = (await app_client.get(f"/internal/reviews/latest?ideaId={IDEA}", headers=h)).json()["review"]
    assert latest["reviewId"] == rid

    assert (await app_client.delete(f"/internal/reviews/{rid}", headers=h)).json() == {"ok": True}
    assert await db.col("agent_reviews").count_documents({"_id": rid}) == 0
    assert await db.db()["agent_checkpoints"].count_documents({"thread_id": {"$regex": rid}}) == 0


async def test_general_chat_quota_and_flat_errors(app_client, fake_node):
    await _setup(fake_node)
    h = as_user(USER)
    hi = (await app_client.post("/internal/reviews", json={"text": "hello"}, headers=h)).json()
    assert hi["kind"] == "general" and "Tell me the idea" in hi["reply"]
    for _ in range(3):
        r = (await app_client.post("/internal/reviews", json={"text": TEXT, "readers": ["nothing"]}, headers=h)).json()
        await _wait_interrupted(r["reviewId"])
    over = await app_client.post("/internal/reviews", json={"text": TEXT}, headers=h)
    assert over.status_code == 429
    body = over.json()
    assert body["code"] == "quota_exceeded" and body["retryable"] is False and body["resetsAt"]
    bad = await app_client.post("/internal/reviews", json={"ideaId": "nope"}, headers=h)
    assert bad.status_code == 422 and bad.json()["code"] == "invalid_input"
