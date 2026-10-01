from typing import NotRequired, TypedDict


class ChatState(TypedDict):
    user_id: str
    text: str
    idea_id: NotRequired[str | None]
    review_id: NotRequired[str | None]
    history: NotRequired[list[dict]]      # [{role: founder|something, text}] last few turns
    kind: NotRequired[str]                # general | judge_request | about_this | new_idea | unsure
    reply: NotRequired[str]
    risk_ids: NotRequired[list[str]]
    context: NotRequired[dict]            # {idea_line, verdict, risks, strengths, facts}
    status: NotRequired[str]
    error: NotRequired[dict]
