from typing import NotRequired, TypedDict


class EchoState(TypedDict):
    message: str
    reply: NotRequired[str]
    status: NotRequired[str]
    error: NotRequired[dict]
    explode_at: NotRequired[str]  # tests: make a node raise to prove errors surface
