"""The Something chat after a review: replies grounded in the review, templates that cost nothing,
chat facts reaching memory, and the no-prediction guard."""
import pytest

from app.chat import service as chat
from app.core import checkpointer, db, jobs, quotas
from app.core.errors import NotFound
from app.core.runs import manager
from app.memory.graph.builder import compile_memory_write
from app.models import fake
from app.review import service as review_service
from app.review.graph.builder import compile_review

USER, IDEA = "65f000000000000000000001", "65f0000000000000000000aa"
TEXT = "Students in hostels have a problem with late night food. We build an app for hostel students to order food at night."


@pytest.fixture
async def review(fake_node):
    import app.chat.fakes  # noqa: F401
    import app.memory.fakes  # noqa: F401
    import app.review.fakes  # noqa: F401
    saver = checkpointer.saver()
    manager.register("memory_write", compile_memory_write(saver))
    manager.register("review", compile_review(saver), on_finish=review_service.on_finish)
    fake_node.add_user(USER, "Founder")
    fake_node.add_idea(IDEA, USER, title="Late night meals", description=TEXT)
    out = await review_service.start(USER, None, idea_id=IDEA, text=None, readers=["something", "nothing"])
    await manager.wait(out["reviewId"])
    return out["reviewId"]


async def test_a_question_gets_a_reply_grounded_in_the_review(review):
    out = await chat.turn(USER, None, "How do I start testing this?", review_id=review)
    assert out["kind"] == "about_this"
    assert "start with the test" in out["reply"] and out["riskIds"] == ["a1"]
    assert out["quota"]["used"] == 1 and out["quota"]["limit"] == 30
    hist = await chat.history(USER, review)
    assert [m["role"] for m in hist] == ["founder", "something"]


async def test_templates_cost_nothing_and_never_predict(review):
    hi = await chat.turn(USER, None, "hi", review_id=review)
    judge = await chat.turn(USER, None, "Is my idea good?", review_id=review)
    assert hi["kind"] == "general" and "quota" not in hi
    assert judge["kind"] == "judge_request" and "won't guess" in judge["reply"]
    assert (await quotas.peek(USER, "chat", 30))["used"] == 0


async def test_a_new_pitch_goes_to_a_review_and_costs_no_chat_turn(review):
    long = "I have a new idea: " + "a bike rental for campuses where students unlock cycles with a QR code and pay per hour " * 2
    assert (await chat.turn(USER, None, long, review_id=review)) == {"kind": "new_idea"}
    mid = "We could also run this as a startup selling compost bags to nurseries around the city instead"
    assert (await chat.turn(USER, None, mid, review_id=review))["kind"] == "new_idea"
    assert (await quotas.peek(USER, "chat", 30))["used"] == 0, "refunded: it wasn't a chat reply"


async def test_statements_about_a_saved_idea_reach_memory(review):
    await chat.turn(USER, None, "Twelve hostel students paid for a trial week", review_id=review)
    await jobs.worker.drain()
    note = await db.col("agent_notes").find_one({"source.type": "chat"})
    assert note and note["provenance"] == "founder_asserted" and "Twelve hostel students" in note["quote"]


async def test_a_prediction_is_replaced_with_the_next_test(review):
    with fake.override("chat.something", lambda inp, ctx: {"reply": "This will definitely succeed!", "risk_ids": []}):
        out = await chat.turn(USER, None, "What should I do first?", review_id=review)
    assert "succeed" not in out["reply"] and out["reply"].startswith("The next step I'd take")


async def test_someone_elses_review_is_not_found(review):
    with pytest.raises(NotFound):
        await chat.turn("65f00000000000000000ffff", None, "How do I test this?", review_id=review)
