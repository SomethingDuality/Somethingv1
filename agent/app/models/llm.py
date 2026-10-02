"""Every model call goes through structured() or text() here (RabbitHole's models/llm.py, hardened).

Hybrid routing (Somay, 2026-10-01):
  - Claude for anything that judges: haiku (memory judge), sonnet (Nothing, rebuttal rulings), opus (pre-mortem).
  - His free HEAVY / LITE fallback chains for cheap work (extraction, briefs, wording, Something's replies).

Rules this file enforces:
  - Claude structured output uses method="json_schema": Sonnet/Opus 5.5 reject forced tool choice.
  - A refusal or a max_tokens stop raises (JudgeRefused / Truncated); nothing is silently half-parsed.
  - Every failover is logged to agent_usage; an exhausted chain raises AllProvidersFailed with all causes.
  - Founders' own text only goes to providers in USER_TEXT_PROVIDERS; when none is available the
    chain ends at Claude Haiku instead.
  - AGENT_FAKE_LLM=true answers from app/models/fake.py, with no network.
"""
import time
from dataclasses import dataclass, field
from typing import Literal, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.core import quotas, usage
from app.core.errors import AllProvidersFailed, BudgetPaused, JudgeRefused, Truncated, Unusable
from app.core.log import warn
from app.core.settings import get_settings
from app.models import fake

Tier = Literal["haiku", "sonnet", "opus", "heavy", "lite", "heavy_even", "heavy_odd"]
T = TypeVar("T", bound=BaseModel)

# His chains (RabbitHole models/llm.py). Even/odd orders spread parallel calls across providers.
HEAVY = [("groq", "llama-3.3-70b-versatile"), ("cerebras", "llama-3.3-70b"), ("sambanova", "Meta-Llama-3.3-70B-Instruct"), ("google", "gemini-2.5-flash")]
HEAVY_EVEN = [("cerebras", "llama-3.3-70b"), ("sambanova", "Meta-Llama-3.3-70B-Instruct"), ("groq", "llama-3.3-70b-versatile"), ("google", "gemini-2.5-flash")]
HEAVY_ODD = [("sambanova", "Meta-Llama-3.3-70B-Instruct"), ("groq", "llama-3.3-70b-versatile"), ("cerebras", "llama-3.3-70b"), ("google", "gemini-2.5-flash")]
LITE = [("groq", "llama-3.1-8b-instant"), ("cerebras", "llama-3.1-8b"), ("sambanova", "Meta-Llama-3.1-8B-Instruct"), ("google", "gemini-2.5-flash")]
CHAINS = {"heavy": HEAVY, "heavy_even": HEAVY_EVEN, "heavy_odd": HEAVY_ODD, "lite": LITE}
# The free providers are fast; a slow one is skipped for the next instead of holding the chain
# (their default is to wait up to 10 minutes).
FREE_TIMEOUT = 15.0


@dataclass
class Prompt:
    """A prompt in his Input / Generate / Rules style. `system` is static (cacheable on Claude);
    `context` and `user` carry the per-call data. `fake_input` feeds fake mode."""
    id: str
    system: str
    user: str
    context: str = ""
    version: str = "v1"
    fake_input: dict = field(default_factory=dict)


def _has_key(provider: str) -> bool:
    s = get_settings()
    return bool({
        "anthropic": s.anthropic_api_key, "groq": s.groq_api_key, "cerebras": s.cerebras_api_key,
        "sambanova": s.sambanova_api_key, "google": s.google_api_key,
    }.get(provider))


def configured_providers() -> dict[str, bool]:
    return {p: _has_key(p) for p in ("anthropic", "groq", "cerebras", "sambanova", "google")}


def _claude_model(tier: str) -> str:
    s = get_settings()
    return {"haiku": s.claude_haiku_model, "sonnet": s.claude_sonnet_model, "opus": s.claude_opus_model}[tier]


def _messages(prompt: Prompt, provider: str):
    if provider == "anthropic":
        blocks = [{"type": "text", "text": prompt.system, "cache_control": {"type": "ephemeral"}}]
        if prompt.context:
            blocks.append({"type": "text", "text": prompt.context})
        system = SystemMessage(content=blocks)
    else:
        system = SystemMessage(content=prompt.system + (f"\n\n{prompt.context}" if prompt.context else ""))
    return [system, HumanMessage(content=prompt.user)]


def _client(provider: str, model: str, max_tokens: int, effort: str | None, temperature: float | None):
    s = get_settings()
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        # Two attempts must fit inside the calling node's timeout (memory 90 s, review 240 s), or
        # the node times out first and the work is thrown away: ~40 s for a short judge, 110 s at most.
        timeout = min(110.0, 30.0 + max_tokens / 50)
        kw = {"model": model, "max_tokens": max_tokens, "api_key": s.anthropic_api_key, "max_retries": 1, "timeout": timeout}
        if effort and not model.startswith("claude-haiku"):
            kw["reasoning_effort"] = effort  # Haiku 4.5 rejects effort
        return ChatAnthropic(**kw)
    if provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(model=model, api_key=s.groq_api_key, max_retries=0, timeout=FREE_TIMEOUT, max_tokens=max_tokens, temperature=temperature if temperature is not None else 0.7)
    if provider in ("cerebras", "sambanova"):
        from langchain_openai import ChatOpenAI
        base = {"cerebras": "https://api.cerebras.ai/v1", "sambanova": "https://api.sambanova.ai/v1"}[provider]
        key = s.cerebras_api_key if provider == "cerebras" else s.sambanova_api_key
        return ChatOpenAI(model=model, api_key=key, base_url=base, max_retries=0, timeout=FREE_TIMEOUT, max_tokens=max_tokens, temperature=temperature if temperature is not None else 0.7)
    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model, google_api_key=s.google_api_key, max_retries=0, timeout=FREE_TIMEOUT, max_output_tokens=max_tokens)
    raise ValueError(f"unknown provider {provider}")


def _route(tier: Tier, user_text: bool) -> list[tuple[str, str]]:
    if tier in ("haiku", "sonnet", "opus"):
        return [("anthropic", _claude_model(tier))]
    allowed = get_settings().user_text_provider_set
    chain = [(p, m) for p, m in CHAINS[tier] if _has_key(p) and (not user_text or p in allowed)]
    # Last resort, and the only route when no free provider is configured: Claude Haiku.
    if _has_key("anthropic"):
        chain.append(("anthropic", _claude_model("haiku")))
    return chain


async def _one(provider: str, model: str, prompt: Prompt, schema, *, max_tokens: int, effort, temperature, ctx: dict):
    started = time.monotonic()
    llm = _client(provider, model, max_tokens, effort, temperature)
    tags = {"tags": [ctx.get("feature", "?"), prompt.id], "metadata": {"prompt_version": prompt.version}}
    if schema is None:
        msg = await llm.ainvoke(_messages(prompt, provider), config=tags)
        raw, parsed, perr = msg, msg.content if isinstance(msg.content, str) else "".join(
            b.get("text", "") for b in msg.content if isinstance(b, dict)), None
    else:
        method = "json_schema" if provider == "anthropic" else "function_calling"
        runnable = llm.with_structured_output(schema, method=method, include_raw=True)
        out = await runnable.ainvoke(_messages(prompt, provider), config=tags)
        raw, parsed, perr = out["raw"], out["parsed"], out.get("parsing_error")
    latency = int((time.monotonic() - started) * 1000)
    stop = (getattr(raw, "response_metadata", None) or {}).get("stop_reason")
    tokens = usage.tokens_from(raw)
    if stop == "refusal":
        await usage.record(ctx, provider=provider, model=model, tokens=tokens, latency_ms=latency, outcome="refusal", effort=effort)
        raise JudgeRefused(prompt.id)
    if stop == "max_tokens":
        await usage.record(ctx, provider=provider, model=model, tokens=tokens, latency_ms=latency, outcome="max_tokens", effort=effort)
        raise Truncated(prompt.id)
    if perr is not None or parsed is None:
        await usage.record(ctx, provider=provider, model=model, tokens=tokens, latency_ms=latency, outcome="error", error_class="parse", effort=effort)
        raise Unusable(f"{prompt.id}: unparseable output from {provider}")
    await usage.record(ctx, provider=provider, model=model, tokens=tokens, latency_ms=latency, effort=effort)
    return parsed


async def _run(prompt: Prompt, schema, *, tier: Tier, ctx: dict, user_text: bool, max_tokens: int, effort, temperature):
    if get_settings().agent_fake_llm:
        out = fake.respond(prompt.id, schema, prompt.fake_input, ctx)
        await usage.record(ctx, provider="fake", model=f"fake:{tier}", outcome="ok")
        return out
    route = _route(tier, user_text)
    if not route:
        raise AllProvidersFailed([f"no configured provider for tier {tier}"])
    causes: list[str] = []
    for provider, model in route:
        try:
            if provider == "anthropic":
                await quotas.check_budget()  # every paid call, not only at a review's start (memory jobs, rulings)
            return await _one(provider, model, prompt, schema, max_tokens=max_tokens, effort=effort, temperature=temperature, ctx=ctx)
        except (JudgeRefused, BudgetPaused):
            raise  # a refusal is an answer, and a paused budget isn't an outage: don't shop them around
        except Exception as e:  # noqa: BLE001 - every provider failure is logged, then the next one is tried
            causes.append(f"{provider}/{model}: {type(e).__name__}")
            warn("llm.failover", prompt=prompt.id, provider=provider, model=model, error=type(e).__name__)
            await usage.record(ctx, provider=provider, model=model, outcome="failover", error_class=type(e).__name__)
            if tier in ("haiku", "sonnet", "opus"):
                if isinstance(e, Unusable):
                    raise  # cut off or unparseable: not an outage, so not retried by the graph either
                break
    raise AllProvidersFailed(causes)


async def structured(prompt: Prompt, schema: type[T], *, tier: Tier, ctx: dict, user_text: bool = True,
                     max_tokens: int = 4000, effort: str | None = None, temperature: float | None = None) -> T:
    out = await _run(prompt, schema, tier=tier, ctx=ctx, user_text=user_text, max_tokens=max_tokens, effort=effort, temperature=temperature)
    return out if isinstance(out, schema) else schema.model_validate(out)


async def text(prompt: Prompt, *, tier: Tier, ctx: dict, user_text: bool = True, max_tokens: int = 1500,
               temperature: float | None = None) -> str:
    out = await _run(prompt, None, tier=tier, ctx=ctx, user_text=user_text, max_tokens=max_tokens, effort=None, temperature=temperature)
    return str(out)
