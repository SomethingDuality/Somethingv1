from langchain_core.runnables import RunnableConfig

from app.memory.graph.state import MemoryWriteState
from app.models import embeddings
from app.utils.ctx import llm_ctx


async def embed_node(state: MemoryWriteState, config: RunnableConfig) -> dict:
    """E_EMBED: one 1024-d vector for the candidate; the model name is stored on the note."""
    [vec] = await embeddings.embed([state["candidate"]["text"]], ctx=llm_ctx(config, "memory", "embed", state["scope"]["user_id"]))
    return {"embedding": vec.tolist(), "embedding_model": embeddings.model_name()}
