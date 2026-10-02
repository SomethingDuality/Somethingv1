from langchain_core.runnables import RunnableConfig

from app.memory import store
from app.memory.graph.state import MemoryWriteState
from app.models import embeddings
from app.utils.ctx import llm_ctx


async def embed_node(state: MemoryWriteState, config: RunnableConfig) -> dict:
    """E_EMBED: one 1024-d vector for the candidate; the model name is stored on the note. A batch
    (ingest.run_all) embeds all its candidates in one call and passes each vector in; it is reused
    only while the text is the one it was made for (a confirm's "change" rewrites the text)."""
    text = state["candidate"]["text"]
    if (state.get("embedding") is not None and state.get("embedding_model") == embeddings.model_name()
            and state.get("embedded_text_key") == store.text_key(text)):
        return {}
    [vec] = await embeddings.embed([text], ctx=llm_ctx(config, "memory", "embed", state["scope"]["user_id"]))
    return {"embedding": vec.tolist(), "embedding_model": embeddings.model_name(), "embedded_text_key": store.text_key(text)}
