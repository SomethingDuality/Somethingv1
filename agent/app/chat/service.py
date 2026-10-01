"""The Something chat: one turn at a time, history per review (or idea) in agent_chats, a daily cap
(30 replies) that counts only real replies (templates and "that's a new idea" are free)."""
from datetime import datetime, timezone

from app.chat.graph.builder import chat_graph
from app.core import db, quotas
from app.core.errors import InvalidInput, NotFound, ProviderUnavailable
from app.core.sanitize import clean
from app.core.settings import get_settings
from app.router.classify import classify_turn

FEATURE = "chat"
HISTORY_MAX = 40


def _key(user_id: str, review_id: str | None, idea_id: str | None) -> str:
    return f"{user_id}:{review_id or idea_id or 'general'}"


async def history(user_id: str, review_id: str | None = None, idea_id: str | None = None) -> list[dict]:
    doc = await db.col("agent_chats").find_one({"_id": _key(user_id, review_id, idea_id)}, {"messages": 1})
    return [{"role": m["role"], "text": m["text"], "at": m["at"].isoformat()} for m in (doc or {}).get("messages", [])]


async def _append(user_id: str, review_id: str | None, idea_id: str | None, msgs: list[dict]) -> None:
    now = datetime.now(timezone.utc)
    await db.col("agent_chats").update_one(
        {"_id": _key(user_id, review_id, idea_id)},
        {"$push": {"messages": {"$each": [{**m, "at": now} for m in msgs], "$slice": -HISTORY_MAX}},
         "$set": {"updated_at": now}, "$setOnInsert": {"user_id": user_id, "idea_id": idea_id, "review_id": review_id}},
        upsert=True,
    )


async def turn(user_id: str, tz: str | None, text: str, *, review_id: str | None = None, idea_id: str | None = None) -> dict:
    text = clean(text, 2000)
    if not text:
        raise InvalidInput("empty")
    if review_id:
        review = await db.col("agent_reviews").find_one({"_id": review_id, "user_id": user_id}, {"idea_id": 1})
        if not review:
            raise NotFound("review")
        idea_id = idea_id or review.get("idea_id")
    rules = classify_turn(text, has_context=bool(review_id or idea_id))["kind"]
    quota = None
    if rules in ("about_this", "unsure"):
        await quotas.check_budget()
        quota = await quotas.consume(user_id, FEATURE, get_settings().chat_turns_per_day, tz)
    past = await history(user_id, review_id, idea_id)
    out = await chat_graph.ainvoke(
        {"user_id": user_id, "text": text, "review_id": review_id, "idea_id": idea_id,
         "history": [{"role": m["role"], "text": m["text"]} for m in past[-8:]]},
        config={"configurable": {"user_id": user_id}},
    )
    if out.get("status") == "failed":
        if quota:
            await quotas.refund(user_id, FEATURE, tz)
        raise ProviderUnavailable((out.get("error") or {}).get("code", "chat failed"))
    kind = out.get("kind")
    if kind == "new_idea":
        if quota:
            await quotas.refund(user_id, FEATURE, tz)  # it's a review, not a chat reply
        return {"kind": "new_idea"}
    await _append(user_id, review_id, idea_id, [{"role": "founder", "text": text}, {"role": "something", "text": out["reply"]}])
    return {"kind": kind, "reply": out["reply"], "riskIds": out.get("risk_ids", []), **({"quota": quota} if quota else {})}
