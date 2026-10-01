# Something agent

The Python agent service behind Something: the memory engine and the Something/Nothing review.
LangGraph graphs served by FastAPI on `127.0.0.1:8000`, called only by the Node backend (service key).
The browser never talks to it directly.

## Run (dev)

```
/opt/homebrew/bin/python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env          # dev placeholders; AGENT_FAKE_LLM=true until keys are in
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the Node backend first (`npm run dev:memory` in `Mutiny_backend_private/`): it runs MongoDB as a
replica set on port 27018 and the internal API on 127.0.0.1:5051.

## Layout

- `app/core/` settings, Mongo, durable checkpoints, service auth, Node client, runs (background runs,
  numbered events, replay), jobs, quotas, usage logging, sanitising, quote checks
- `app/models/` `llm.py` (the only path to a model: Claude judges, free HEAVY/LITE chains), fake scripts, embeddings
- `app/memory/` the memory engine (SO0 `E_`): `graph/`, `nodes/`, `prompts/`, the decision table, store, read path, ingestion, confirms
- `app/review/` the review (SO0 `CR_` + Something): `graph/`, `nodes/`, `prompts/`, aggregation and verdict in code
- `app/router/` the intent router (SO0 `RT_`), minimal
- `app/api/` the internal HTTP API Node calls
- `tests/` pytest against a real replica-set mongod, fake models (`.venv/bin/pytest -q`)

## Checks

```
.venv/bin/pytest -q
.venv/bin/ruff check . --exclude .venv
```
