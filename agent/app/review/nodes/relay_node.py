"""Something's reply. Code puts Nothing's words in front of the founder unchanged; the model only
writes how to address each risk, and relay_check() rejects softening, verdict talk and invented
numbers (research: relay fidelity), falling back to a plain template."""
import re

from langchain_core.runnables import RunnableConfig

from app.core.errors import AgentError
from app.core.log import warn
from app.models import llm
from app.review import store
from app.review.graph.state import ReviewState
from app.review.prompts.something_prompt import RELAY_PROMPT
from app.review.relay_templates import fallback_address, relay_check
from app.review.schemas import RelayOut
from app.review.view import something_view
from app.utils.ctx import llm_ctx
from app.utils.progress import publish

_NUM = re.compile(r"\d[\d,.]*")


async def relay_node(state: ReviewState, config: RunnableConfig) -> dict:
    if "something" not in state["readers"]:
        return {}
    steelman = state.get("steelman")
    rows = [r for r in state.get("aggregate") or [] if r["severity"] in ("blocking", "important")][: state["limits"]["max_risks_shown"]]
    address: list[dict] = []
    if rows:
        lines = "\n".join(f"{r['assumption_id']}: {r['title']} | test: {r['test']['text']} | settled by: {r['criteria']}" for r in rows)
        strengths = "\n".join(f"- {s['text']}" for s in (steelman or {}).get("strengths", [])) or "(none)"
        allowed = set(_NUM.findall(lines + strengths)) | {n.strip(".,") for n in _NUM.findall(lines + strengths)}
        written: dict[str, str] = {}
        try:
            out = await llm.structured(
                llm.Prompt(id="review.relay", version="review.relay.v1", system=RELAY_PROMPT,
                           user=f"Risks:\n{lines}\n\nWhat Something found strong:\n{strengths}", fake_input={"rows": rows}),
                RelayOut, tier="heavy_odd", user_text=True, max_tokens=1200,
                ctx=llm_ctx(config, "review", "relay", state["user_id"], review_id=state["review_id"]))
            written = {a.risk_id: a.text.strip() for a in out.address}
        except AgentError as e:
            warn("review.relay_failed", review=state["review_id"], code=e.code)
        for r in rows:
            text = written.get(r["assumption_id"], "")
            address.append({"riskId": r["assumption_id"], "text": text if relay_check(text, allowed) else fallback_address(r["test"])})
    view = something_view(steelman, address, state["brief"]) or {"strengths": [], "concessions": [], "address": address, "nextProof": ""}
    view["unavailable"] = steelman is None
    await publish(config, "reader", {"reader": "something", **view})
    await store.save({**state, "address": address})
    return {"address": address}
