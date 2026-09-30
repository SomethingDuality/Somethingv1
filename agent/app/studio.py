"""Graphs for LangGraph Studio (langgraph.json), compiled without a checkpointer: Studio brings its own.
Needs agent/.env (keys or AGENT_FAKE_LLM=true)."""
from app.diagnostics.graph.builder import build_echo_graph
from app.memory import fakes as _memory_fakes  # noqa: F401
from app.memory.graph.builder import build_memory_write_graph
from app.review import fakes as _review_fakes  # noqa: F401
from app.review.graph.builder import build_review_graph

echo = build_echo_graph().compile()
memory_write = build_memory_write_graph().compile()
review = build_review_graph().compile()
