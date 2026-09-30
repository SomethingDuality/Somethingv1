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
    await quotas.refund("u1", "review")
    assert (await quotas.peek("u1", "review", 3))["used"] == 2


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
