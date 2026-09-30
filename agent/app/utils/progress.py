"""Progress and view events from inside graph nodes (RabbitHole's update_progress(config, msg)).

The RunManager puts an `emit` coroutine into config["configurable"]; nodes call
`await progress(config, stage, text)` or `await publish(config, event, data)`. Nodes are async and
run on the event loop, so there is no thread hop (his version lost messages in executor threads).

We don't use LangGraph's stream_mode="custom": in langgraph 1.2.12 it disables node error handlers
(probed 2026-10-01; see chat/gotcha.md)."""
from langchain_core.runnables import RunnableConfig


async def publish(config: RunnableConfig | None, event: str, data: dict) -> None:
    emit = ((config or {}).get("configurable") or {}).get("emit")
    if emit is not None:
        await emit(event, data)


async def progress(config: RunnableConfig | None, stage: str, text: str) -> None:
    await publish(config, "progress", {"stage": stage, "text": text})
