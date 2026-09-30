"""Who is calling. Only Node may call the agent (X-Agent-Key). Node has already checked the login
cookie and passes the user in X-Agent-User-Id / -Role; those headers mean nothing without the key,
and handlers still check that the user owns what they ask for."""
from dataclasses import dataclass

from fastapi import Header, HTTPException

from app.core.auth import key_matches
from app.core.settings import get_settings


@dataclass(frozen=True)
class Caller:
    user_id: str | None
    role: str | None
    tz: str | None


async def service(
    x_agent_key: str | None = Header(default=None),
    x_agent_user_id: str | None = Header(default=None),
    x_agent_user_role: str | None = Header(default=None),
    x_agent_user_tz: str | None = Header(default=None),
) -> Caller:
    s = get_settings()
    if not key_matches(x_agent_key, s.node_to_agent_key, s.node_to_agent_key_previous):
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "Bad service key"})
    return Caller(user_id=x_agent_user_id, role=x_agent_user_role, tz=x_agent_user_tz)


def require_user(caller: Caller) -> str:
    if not caller.user_id:
        raise HTTPException(status_code=400, detail={"code": "invalid_input", "message": "Missing user"})
    return caller.user_id
