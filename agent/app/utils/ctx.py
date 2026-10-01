"""The usage-log context for a model call made from a node (who, which feature, which node, which run)."""
from langchain_core.runnables import RunnableConfig


def llm_ctx(config: RunnableConfig | None, feature: str, node: str, user_id: str | None = None, **extra) -> dict:
    conf = (config or {}).get("configurable") or {}
    return {"feature": feature, "node": node, "run_id": conf.get("run_id"), "user_id": user_id or conf.get("user_id"), **extra}
