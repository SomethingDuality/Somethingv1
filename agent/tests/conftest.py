"""Test harness: a real single-node replica set (transactions need one), fake models, a fake Node.

mongod comes from MONGOD_BIN, or the binary mongodb-memory-server already downloaded for the Node
tests (~/.cache/mongodb-binaries). Set MONGO_TEST_URI to use an existing replica set instead."""
import os
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _mongod_bin() -> str:
    if os.environ.get("MONGOD_BIN"):
        return os.environ["MONGOD_BIN"]
    cache = Path.home() / ".cache" / "mongodb-binaries"
    found = sorted(cache.glob("mongod-*")) if cache.exists() else []
    if found:
        return str(found[-1])
    if shutil.which("mongod"):
        return shutil.which("mongod")
    pytest.exit("no mongod binary: set MONGOD_BIN or MONGO_TEST_URI (or run the Node tests once to download one)")


def _start_replset():
    from pymongo import MongoClient
    port = _free_port()
    dbpath = tempfile.mkdtemp(prefix="agent-test-mongo-")
    proc = subprocess.Popen(
        [_mongod_bin(), "--replSet", "rs0", "--port", str(port), "--bind_ip", "127.0.0.1", "--dbpath", dbpath, "--quiet"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    client = MongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", serverSelectionTimeoutMS=500)
    for _ in range(100):
        try:
            client.admin.command("ping")
            break
        except Exception:  # noqa: BLE001 - waiting for mongod to listen
            time.sleep(0.1)
    client.admin.command("replSetInitiate", {"_id": "rs0", "members": [{"_id": 0, "host": f"127.0.0.1:{port}"}]})
    for _ in range(200):
        if client.admin.command("hello").get("isWritablePrimary"):
            break
        time.sleep(0.1)
    client.close()
    return proc, dbpath, f"mongodb://127.0.0.1:{port}/agent_test?replicaSet=rs0"


_PROC = None
_DBPATH = None
if os.environ.get("MONGO_TEST_URI"):
    _URI = os.environ["MONGO_TEST_URI"]
else:
    _PROC, _DBPATH, _URI = _start_replset()

os.environ.update({
    "AGENT_IGNORE_ENV_FILE": "1",
    "AGENT_ENV": "test",
    "MONGO_URI": _URI,
    "NODE_TO_AGENT_KEY": "test-node-to-agent",
    "AGENT_TO_NODE_KEY": "test-agent-to-node",
    "AGENT_FAKE_LLM": "true",
    "NODE_INTERNAL_URL": "http://node.test",
    "DAILY_USD_CAP": "5",
})
for k in ("ANTHROPIC_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "SAMBANOVA_API_KEY", "GOOGLE_API_KEY", "JINA_API_KEY"):
    os.environ[k] = ""


def pytest_sessionfinish(session, exitstatus):
    if _PROC:
        _PROC.terminate()
        try:
            _PROC.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _PROC.kill()
        shutil.rmtree(_DBPATH, ignore_errors=True)


@pytest.fixture(autouse=True)
async def clean_db():
    from app.core import db
    for name in list(db.INDEXES) + list(db.CHECKPOINT_COLLECTIONS):
        await db.db()[name].delete_many({})
    yield


@pytest.fixture
def fake_node():
    from app.core import node_client
    from tests.fakes.node_server import FakeNode
    node = FakeNode()
    node_client.set_transport(node.transport())
    yield node
    node_client.set_transport(None)


@pytest.fixture
async def app_client(fake_node):
    import httpx

    from app.main import app, lifespan
    async with lifespan(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://agent.test") as client:
            yield client


SERVICE = {"X-Agent-Key": "test-node-to-agent"}


def as_user(user_id: str, role: str = "Founder") -> dict:
    return {**SERVICE, "X-Agent-User-Id": user_id, "X-Agent-User-Role": role}
