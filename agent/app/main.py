"""The agent service: FastAPI on 127.0.0.1:8000, called only by Node (service key).

Run (dev):  cd agent && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import diagnostics, erase, events, health
from app.core import checkpointer, db, node_client
from app.core.errors import AgentError
from app.core.jobs import worker
from app.core.log import log
from app.core.runs import manager
from app.core.settings import get_settings
from app.diagnostics.graph.builder import compile_echo
from app.registry import register_features


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    await db.ensure_indexes()
    saver = checkpointer.saver()
    manager.register("echo", compile_echo(saver))
    register_features(manager, saver)
    worker.start()
    await manager.recover()
    log("agent.started", env=s.agent_env, fake_llm=s.agent_fake_llm, port=s.port)
    try:
        yield
    finally:
        await manager.shutdown()
        await worker.stop()
        await node_client.close()
        await db.close()
        checkpointer.close()


def create_app() -> FastAPI:
    s = get_settings()
    dev = s.agent_env != "production"
    app = FastAPI(title="Something agent", lifespan=lifespan,
                  docs_url="/docs" if dev else None, redoc_url=None, openapi_url="/openapi.json" if dev else None)

    # Every error is one flat shape {code, message, retryable}: Node passes it on as it is.
    @app.exception_handler(AgentError)
    async def agent_error(_req: Request, exc: AgentError):
        return JSONResponse(status_code=exc.status, content=exc.public())

    @app.exception_handler(HTTPException)
    async def http_error(_req: Request, exc: HTTPException):
        body = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content={"retryable": False, **body})

    @app.exception_handler(RequestValidationError)
    async def invalid(_req: Request, _exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"code": "invalid_input", "message": "That request isn't valid.", "retryable": False})

    for router in (health.router, events.router, erase.router, diagnostics.router):
        app.include_router(router)
    from app.registry import routers
    for router in routers():
        app.include_router(router)
    return app


app = create_app()
