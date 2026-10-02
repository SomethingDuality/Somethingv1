"""All configuration, read once from the environment (agent/.env in dev).

The service refuses to start without its two service keys, and refuses fake mode or the
dev placeholder keys in production. Model ids, limits and prices live here, not in code.
"""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_KEYS = {"dev-only-node-to-agent", "dev-only-agent-to-node"}
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"  # agent/.env, wherever the process starts


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    agent_env: Literal["dev", "test", "production"] = "dev"
    host: str = "127.0.0.1"
    port: int = 8000

    mongo_uri: str = "mongodb://127.0.0.1:27018/something_dev?replicaSet=rs0"
    node_internal_url: str = "http://127.0.0.1:5051"

    # One key per direction, so a leak of one doesn't open both.
    node_to_agent_key: str = ""
    node_to_agent_key_previous: str = ""
    agent_to_node_key: str = ""

    # Fake mode: scripted model outputs and deterministic embeddings, for tests and key-less dev.
    agent_fake_llm: bool = False

    anthropic_api_key: str = ""
    groq_api_key: str = ""
    cerebras_api_key: str = ""
    sambanova_api_key: str = ""
    google_api_key: str = ""
    jina_api_key: str = ""

    claude_haiku_model: str = "claude-haiku-4-5-20251001"
    claude_sonnet_model: str = "claude-sonnet-5-5"
    claude_opus_model: str = "claude-opus-5-5"
    embedding_model: str = "jina-embeddings-v3"
    embedding_dims: int = 1024

    # Free providers allowed to see founders' own text (ideas, answers). Somay decides which
    # free tiers' data terms are acceptable; the others only get text we wrote ourselves.
    user_text_providers: str = "groq,cerebras,sambanova"

    reviews_per_day: int = 3
    chat_turns_per_day: int = 30
    daily_usd_cap: float = 5.0
    max_rebuttal_rounds: int = 2
    nothing_samples: int = 3

    memory_gate_cosine: float = Field(0.40, description="Below this (and no same-slot note) a candidate is added without a judge. Uncalibrated.")
    confirm_ttl_days: int = 14

    # interim = the rules + similarity matcher in app/brain; "brain" = Prapti's model, once it exists.
    matcher: Literal["interim", "brain"] = "interim"
    match_cadence_days: int = 7
    match_batch_size: int = 5

    langsmith_tracing: bool = False

    @model_validator(mode="after")
    def _guard(self) -> "Settings":
        if not self.node_to_agent_key or not self.agent_to_node_key:
            raise ValueError("NODE_TO_AGENT_KEY and AGENT_TO_NODE_KEY must be set (see agent/.env.example)")
        if self.agent_env == "production":
            if self.agent_fake_llm:
                raise ValueError("AGENT_FAKE_LLM is not allowed in production")
            if {self.node_to_agent_key, self.node_to_agent_key_previous, self.agent_to_node_key} & DEV_KEYS:
                raise ValueError("dev placeholder service keys are not allowed in production")
            if self.node_to_agent_key == self.agent_to_node_key:
                raise ValueError("NODE_TO_AGENT_KEY and AGENT_TO_NODE_KEY must differ (one key per direction)")
        return self

    @property
    def user_text_provider_set(self) -> set[str]:
        return {p.strip() for p in self.user_text_providers.split(",") if p.strip()}


@lru_cache
def get_settings() -> Settings:
    import os
    # Tests set everything through the environment and must not pick up a developer's agent/.env.
    return Settings(_env_file=None) if os.environ.get("AGENT_IGNORE_ENV_FILE") == "1" else Settings()
