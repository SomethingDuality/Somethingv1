import asyncio

import pytest

from app.core.auth import key_matches


def test_key_matches():
    assert key_matches("abc", "abc")
    assert not key_matches("abd", "abc")
    assert not key_matches(None, "abc")
    assert not key_matches("", "")
    assert key_matches("old", "new", previous="old")  # rotation window


def test_settings_refuse_without_keys(monkeypatch):
    from pydantic import ValidationError

    from app.core.settings import Settings
    monkeypatch.setenv("NODE_TO_AGENT_KEY", "")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_refuse_fake_or_dev_keys_in_production(monkeypatch):
    from pydantic import ValidationError

    from app.core.settings import Settings
    monkeypatch.setenv("AGENT_ENV", "production")
    monkeypatch.setenv("AGENT_FAKE_LLM", "true")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
    monkeypatch.setenv("AGENT_FAKE_LLM", "false")
    monkeypatch.setenv("NODE_TO_AGENT_KEY", "dev-only-node-to-agent")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


async def test_quota_is_atomic_under_parallel_requests():
    from app.core import quotas
    from app.core.errors import QuotaExceeded
    results = await asyncio.gather(*[quotas.consume("u1", "review", 3) for _ in range(10)], return_exceptions=True)
    ok = [r for r in results if isinstance(r, dict)]
    assert len(ok) == 3
    assert all(isinstance(r, QuotaExceeded) for r in results if not isinstance(r, dict))
    await quotas.refund("u1", "review", ok[0]["day"])
    assert (await quotas.peek("u1", "review", 3))["used"] == 2


async def test_switching_time_zones_doesnt_open_a_new_day():
    from app.core import quotas
    from app.core.errors import QuotaExceeded
    for tz in ("Etc/GMT+12", "Pacific/Kiritimati", "UTC"):
        for _ in range(3):
            try:
                await quotas.consume("u2", "review", 3, tz)
            except QuotaExceeded:
                pass
    assert (await quotas.peek("u2", "review", 3, "Pacific/Kiritimati"))["used"] == 3, "3 a real day, whatever zone is sent"


async def test_parallel_first_requests_of_the_day_both_count():
    from app.core import quotas
    for user in [f"race{i}" for i in range(15)]:
        out = await asyncio.gather(quotas.consume(user, "review", 3), quotas.consume(user, "review", 3), return_exceptions=True)
        assert all(isinstance(r, dict) for r in out), out


async def test_budget_breaker():
    from app.core import quotas
    from app.core.errors import BudgetPaused
    await quotas.check_budget()
    await quotas.add_spend(5.0)
    with pytest.raises(BudgetPaused):
        await quotas.check_budget()


def test_day_window_uses_local_day():
    from datetime import datetime, timezone

    from app.core.quotas import day_window
    now = datetime(2026, 10, 1, 20, 0, tzinfo=timezone.utc)  # 01:30 on Oct 2 in Kolkata
    assert day_window("Asia/Kolkata", now)[0] == "2026-10-02"
    assert day_window("not/a-zone", now)[0] == "2026-10-01"


def test_unknown_claude_ids_are_never_free_and_cache_writes_count():
    from types import SimpleNamespace

    from app.core.usage import cost_usd, tokens_from
    assert cost_usd("claude-haiku-4-5", 1_000_000, 1_000_000) == cost_usd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000) > 0
    assert cost_usd("claude-sonnet-6-0", 1_000_000, 0) > 0
    msg = SimpleNamespace(usage_metadata={"input_tokens": 1000, "output_tokens": 10,
                                          "input_token_details": {"cache_read": 0, "cache_creation": 0, "ephemeral_5m_input_tokens": 800}})
    assert tokens_from(msg)["cache_creation_input_tokens"] == 800


async def test_changed_index_options_rebuild_instead_of_failing_boot():
    from pymongo import ASCENDING, IndexModel

    from app.core import db
    await db.db()["agent_run_events"].drop_indexes()
    await db.db()["agent_run_events"].create_indexes([IndexModel([("at", ASCENDING)], expireAfterSeconds=60)])
    await db.ensure_indexes()  # the TTL differs from INDEXES: rebuilt, not a crash
    info = await db.db()["agent_run_events"].index_information()
    assert info["at_1"]["expireAfterSeconds"] == 7 * 24 * 3600
