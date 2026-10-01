"""Fake mode (AGENT_FAKE_LLM=true): scripted, deterministic model outputs keyed by prompt id.

Each feature registers a default script for its prompts (e.g. review/fakes.py), built from the
prompt's `fake_input`, so the whole product runs end to end without keys or network.
Tests override a script with `override(prompt_id, fn)` to force refusals, splits, bad cites, etc."""
from collections.abc import Callable
from contextlib import contextmanager

_DEFAULTS: dict[str, Callable] = {}
_OVERRIDES: dict[str, Callable] = {}


def register(prompt_id: str):
    def wrap(fn: Callable):
        _DEFAULTS[prompt_id] = fn
        return fn
    return wrap


@contextmanager
def override(prompt_id: str, fn: Callable):
    _OVERRIDES[prompt_id] = fn
    try:
        yield
    finally:
        _OVERRIDES.pop(prompt_id, None)


def respond(prompt_id: str, schema, fake_input: dict, ctx: dict):
    fn = _OVERRIDES.get(prompt_id) or _DEFAULTS.get(prompt_id)
    if fn is None:
        raise LookupError(f"no fake script registered for prompt {prompt_id!r}")
    out = fn(fake_input, ctx)
    if isinstance(out, BaseException):
        raise out
    if schema is not None and isinstance(out, dict):
        return schema.model_validate(out)
    return out
