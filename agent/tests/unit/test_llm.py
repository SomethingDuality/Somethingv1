"""The model layer: routing (hybrid + who may see founder text), failover logging, refusals."""
import pytest
from pydantic import BaseModel

from app.core import db
from app.core.errors import AllProvidersFailed, JudgeRefused
from app.models import fake, llm


class Out(BaseModel):
    answer: str


def _settings(monkeypatch, **kw):
    from app.core.settings import get_settings
    s = get_settings()
    for k, v in kw.items():
        monkeypatch.setattr(s, k, v)
    return s


def test_route_hybrid_and_user_text(monkeypatch):
    _settings(monkeypatch, groq_api_key="x", google_api_key="x", anthropic_api_key="x", user_text_providers="groq,cerebras")
    assert llm._route("sonnet", True) == [("anthropic", "claude-sonnet-5-5")]
    heavy_user = [p for p, _ in llm._route("heavy", True)]
    assert heavy_user == ["groq", "anthropic"]  # google is configured but may not see founder text
    heavy_ours = [p for p, _ in llm._route("heavy", False)]
    assert heavy_ours == ["groq", "google", "anthropic"]


def test_route_ends_at_haiku_when_no_free_provider(monkeypatch):
    _settings(monkeypatch, anthropic_api_key="x")
    assert llm._route("lite", True) == [("anthropic", "claude-haiku-4-5-20251001")]


async def test_fake_mode_uses_registered_script():
    fake.register("test.echo")(lambda inp, ctx: {"answer": inp["q"].upper()})
    out = await llm.structured(llm.Prompt(id="test.echo", system="s", user="u", fake_input={"q": "hi"}), Out, tier="heavy", ctx={"feature": "t"})
    assert out.answer == "HI"
    assert await db.col("agent_usage").count_documents({"provider": "fake"}) == 1


async def test_failover_is_logged_and_exhaustion_raises(monkeypatch):
    _settings(monkeypatch, agent_fake_llm=False, groq_api_key="x", cerebras_api_key="x", user_text_providers="groq,cerebras")

    async def broken(provider, model, prompt, schema, **kw):
        raise ConnectionError(f"{provider} down")
    monkeypatch.setattr(llm, "_one", broken)
    with pytest.raises(AllProvidersFailed) as exc:
        await llm.structured(llm.Prompt(id="t", system="s", user="u"), Out, tier="heavy", ctx={"feature": "t"})
    assert len(exc.value.causes) == 2
    assert await db.col("agent_usage").count_documents({"outcome": "failover"}) == 2


async def test_refusal_is_not_shopped_around(monkeypatch):
    _settings(monkeypatch, agent_fake_llm=False, groq_api_key="x", anthropic_api_key="x", user_text_providers="groq")
    calls = []

    async def refuse(provider, model, prompt, schema, **kw):
        calls.append(provider)
        raise JudgeRefused("t")
    monkeypatch.setattr(llm, "_one", refuse)
    with pytest.raises(JudgeRefused):
        await llm.structured(llm.Prompt(id="t", system="s", user="u"), Out, tier="heavy", ctx={})
    assert calls == ["groq"]


def test_claude_messages_cache_the_static_prefix():
    p = llm.Prompt(id="t", system="RUBRIC", user="IDEA", context="ANCHORS")
    sys_msg, human = llm._messages(p, "anthropic")
    assert sys_msg.content[0]["cache_control"] == {"type": "ephemeral"}
    assert sys_msg.content[1]["text"] == "ANCHORS"
    assert human.content == "IDEA"
    plain, _ = llm._messages(p, "groq")
    assert isinstance(plain.content, str)
