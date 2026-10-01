"""Something's reply in the chat (HEAVY free chain: Something never judges, so it isn't a Claude
judge call). A reply that predicts, scores, praises the idea or shouts is replaced by a plain
pointer to the next test (the same fidelity rule as the review's relay)."""
import re

from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, ConfigDict, Field

from app.chat.graph.state import ChatState
from app.chat.prompts.something_chat_prompt import SOMETHING_CHAT_INPUT, SOMETHING_CHAT_PROMPT
from app.core.sanitize import spotlight
from app.models import llm
from app.utils.ctx import llm_ctx


class ChatReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str = Field(description="At most 120 words.")
    risk_ids: list[str]


_BAD = re.compile(r"\b(will (definitely |surely )?(succeed|work|fail)|great idea|amazing idea|brilliant|guaranteed|"
                  r"\d+ ?% (chance|likely)|score of|rated? (it )?\d|you('| a)re ready to raise)\b", re.I)


def chat_check(text: str) -> bool:
    return bool(text) and len(text) <= 900 and "!" not in text and not _BAD.search(text)


def fallback(ctx: dict) -> str:
    open_risks = [r for r in ctx.get("risks", []) if r["status"] in ("open", "stands", "needs_test")]
    if open_risks:
        r = open_risks[0]
        return f"The next step I'd take: {r['test'].rstrip('.')}. That's what would settle “{r['title']}”."
    return "Tell me a bit more about who this is for and what they do today, and I'll suggest the next thing to test."


async def reply_node(state: ChatState, config: RunnableConfig) -> dict:
    ctx = state["context"]
    history = "\n".join(f"{m['role']}: {m['text']}" for m in (state.get("history") or [])[-8:]) or "(none)"
    user = SOMETHING_CHAT_INPUT.format(
        idea_line=ctx["idea_line"] or "(not stated)", verdict=ctx["verdict"],
        risks="\n".join(f"{r['id']}: {r['title']} | test: {r['test']} | settled by: {r['criteria']} | status: {r['status']}" for r in ctx["risks"]) or "(none)",
        strengths="\n".join(f"- {s}" for s in ctx["strengths"]) or "(none)",
        facts="\n".join(f"- {f}" for f in ctx["facts"]) or "(none)",
        history=history, message=spotlight(state["text"]),
    )
    out = await llm.structured(
        llm.Prompt(id="chat.something", version="chat.something.v1", system=SOMETHING_CHAT_PROMPT, user=user,
                   fake_input={"text": state["text"], "context": ctx}),
        ChatReply, tier="heavy_even", user_text=True, max_tokens=700, ctx=llm_ctx(config, "chat", "reply", state["user_id"]))
    reply = out.reply.strip()
    if not chat_check(reply):
        reply = fallback(ctx)
    known = {r["id"] for r in ctx["risks"]}
    return {"reply": reply, "risk_ids": [r for r in out.risk_ids if r in known]}
