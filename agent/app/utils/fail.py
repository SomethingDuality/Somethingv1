"""The default error handler for every graph (set with set_node_defaults(error_handler=...)).

A node that raises lands here: the run ends with status 'failed' and a user-safe error, which the
RunManager turns into an SSE `error` event. Nothing is swallowed (RabbitHole's grader turned an
error into "all documents irrelevant" and silently changed the route)."""
from langgraph.errors import NodeError
from langgraph.graph import END
from langgraph.types import Command

from app.core.errors import AgentError
from app.core.log import error as log_error


async def fail_node(state: dict, error: NodeError) -> Command:
    exc = error.error
    public = exc.public() if isinstance(exc, AgentError) else AgentError().public()
    log_error("graph.node_failed", node=error.node, error=type(exc).__name__, detail=str(exc)[:300])
    return Command(update={"status": "failed", "error": {**public, "node": error.node}}, goto=END)
