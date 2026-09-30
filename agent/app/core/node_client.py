"""Calls to Node's internal listener (127.0.0.1:5051). Node owns users and ideas: the agent reads
them through `context` and changes them only through `apply_update`, which records
fieldSources.<field>.source = 'agent' (one write path, with provenance)."""
import httpx

from app.core.errors import NodeUnavailable, NotFound
from app.core.settings import get_settings

_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        s = get_settings()
        _client = httpx.AsyncClient(
            base_url=s.node_internal_url,
            headers={"X-Agent-Key": s.agent_to_node_key},
            timeout=httpx.Timeout(5.0, connect=2.0),
        )
    return _client


def set_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    """Tests swap in a fake Node."""
    global _client
    s = get_settings()
    _client = httpx.AsyncClient(
        base_url=s.node_internal_url,
        headers={"X-Agent-Key": s.agent_to_node_key},
        transport=transport,
        timeout=5.0,
    ) if transport else None


async def _call(method: str, path: str, **kw) -> dict:
    try:
        res = await _http().request(method, path, **kw)
    except httpx.HTTPError as e:
        raise NodeUnavailable(f"{method} {path}: {type(e).__name__}") from e
    if res.status_code == 404:
        raise NotFound(f"{method} {path}")
    if res.status_code == 422:
        return {"ok": False, "status": 422, **(res.json() if res.content else {})}
    if res.status_code >= 400:
        raise NodeUnavailable(f"{method} {path}: HTTP {res.status_code}")
    return res.json() if res.content else {}


async def context(user_id: str, *, idea_id: str | None = None, purpose: str = "review") -> dict:
    params = {"purpose": purpose}
    if idea_id:
        params["ideaId"] = idea_id
    return await _call("GET", f"/internal/context/{user_id}", params=params)


async def apply_update(user_id: str, patch: dict, *, entity: str = "user", entity_id: str | None = None, ref: str | None = None) -> dict:
    body = {"userId": user_id, "entity": entity, "patch": patch}
    if entity_id:
        body["entityId"] = entity_id
    if ref:
        body["ref"] = ref
    return await _call("POST", "/internal/apply-update", json=body)


async def notify(user_id: str, text: str, *, key: str, link: str | None = None) -> dict:
    return await _call("POST", "/internal/notify", json={"userId": user_id, "text": text, "key": key, "link": link})


async def put_question(confirm_id: str, payload: dict) -> dict:
    return await _call("PUT", f"/internal/questions/{confirm_id}", json=payload)


async def delete_question(confirm_id: str) -> dict:
    return await _call("DELETE", f"/internal/questions/{confirm_id}")


async def match_ideas() -> list[dict]:
    """Every public idea as a match packet (no drafts, no hidden ideas)."""
    return (await _call("GET", "/internal/match/ideas", timeout=20.0)).get("ideas", [])


async def match_user(user_id: str) -> dict:
    return await _call("GET", f"/internal/match/user/{user_id}")


async def match_users(role: str, after: str | None = None) -> list[str]:
    params = {"role": role, **({"after": after} if after else {})}
    return (await _call("GET", "/internal/match/users", params=params)).get("ids", [])


async def health() -> dict:
    return await _call("GET", "/internal/health")


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
