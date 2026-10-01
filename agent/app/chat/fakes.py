"""Fake-mode scripts for the chat prompts (see models/fake.py)."""
from app.models import fake


@fake.register("chat.something")
def fake_chat(inp: dict, ctx: dict) -> dict:
    risks = [r for r in inp["context"].get("risks", []) if r["status"] in ("open", "stands", "needs_test")]
    if risks:
        r = risks[0]
        return {"reply": f"For “{r['title']}”, start with the test: {r['test']} Write down what each person says, word for word.",
                "risk_ids": [r["id"]]}
    return {"reply": "Tell me who this is for and what they do today, and we'll pick the first thing to test.", "risk_ids": []}


@fake.register("router.classify")
def fake_route(inp: dict, ctx: dict) -> dict:
    return {"kind": "new_idea" if "startup" in inp["text"].lower() else "about_this"}
