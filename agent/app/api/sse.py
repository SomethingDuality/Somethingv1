"""SSE for a run: stored events after `after`, then live ones, a ping comment every 15 s.
Event ids are the run's seq, so a client reconnects with ?after=<last id> and misses nothing.
Only view-shaped data is ever published (no raw state, no traces)."""
import json

from fastapi.responses import StreamingResponse
from fastapi.sse import KEEPALIVE_COMMENT, format_sse_event

from app.core.runs import PING, manager

HEADERS = {"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"}


async def _frames(run_id: str, after: int):
    async for ev in manager.subscribe(run_id, after):
        if ev is PING:
            yield KEEPALIVE_COMMENT
            continue
        data = json.dumps({"v": 1, **ev["data"]}, default=str, separators=(",", ":"))
        yield format_sse_event(data_str=data, event=ev["type"], id=str(ev["seq"]))


def stream(run_id: str, after: int = 0) -> StreamingResponse:
    return StreamingResponse(_frames(run_id, after), media_type="text/event-stream", headers=HEADERS)
