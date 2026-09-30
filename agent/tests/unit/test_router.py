"""The intent router's rules (no model call)."""
import pytest

from app.router.classify import classify, classify_turn


@pytest.mark.parametrize("text,ctx,kind", [
    ("hi", True, "general"),
    ("what can you do?", True, "general"),
    ("Is my idea good?", True, "judge_request"),
    ("will this work", True, "judge_request"),
    ("How do I find five canteen managers?", True, "about_this"),
    ("We have 3 paying canteens now", True, "about_this"),
    ("I have a new idea: an app for renting cycles on campus by the hour, unlocked with a QR code", True, "new_idea"),
    (" ".join(["word"] * 40), True, "new_idea"),
    ("Canteens in Pune said they would pay more if pickup happened twice a day instead of once", True, "unsure"),
    ("Composting for canteens, paid per kilo collected.", False, "new_idea"),
    ("hello", False, "general"),
])
def test_classify_turn(text, ctx, kind):
    assert classify_turn(text, has_context=ctx)["kind"] == kind


def test_phase_c_classify_still_works():
    assert classify("hi")["kind"] == "general"
    assert classify("Composting for university canteens, paid per kilo.")["kind"] == "new_idea"
