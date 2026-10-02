# Contributing to Something

Thanks for helping. This guide gets you from a fresh clone to a passing pull request. Nothing here
needs a paid key: the AI agent runs on fake models locally and in CI.

## The parts

| Folder | What it is | Stack |
|---|---|---|
| `frontend/` | The website | Next.js 15, React 19, TypeScript, Tailwind 4 |
| `Mutiny_backend_private/` | The API | Node 24, Express 5, Mongoose |
| `agent/` | The AI reviewer, memory and matching | Python 3.12, FastAPI, LangGraph |
| `shared/` | Lists the three apps share (sectors, word filter, question bank) | JSON, copied into each app |

## Run it locally

You need Node 24 and Python 3.12. MongoDB is not needed: the API starts its own in-memory database.

1. **API** (port 5050, with a seeded test founder and investor):
   ```bash
   cd Mutiny_backend_private
   cp .env.example .env    # then set ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET to any two different long random strings
   npm install
   npm run dev:memory      # wait for "[dev:memory] seeded"
   ```
2. **Agent** (port 8000, fake models), after the API is up:
   ```bash
   cd agent
   python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
   cp .env.example .env    # the defaults are for local use: fake models, dev-only keys
   .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
3. **Website** (port 3000, the address the API's `.env.example` allows):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open http://localhost:3000/login and use "Continue as test founder" or "Continue as test investor".
   On another port, set `CLIENT_ORIGIN` and `APP_BASE_URL` in the API's `.env` to match.

## Before you open a pull request

Run the checks for the parts you changed. CI runs the same ones, and only for the parts your change
touches.

| Changed | Run |
|---|---|
| `agent/` | `cd agent && .venv/bin/ruff check . --exclude .venv && .venv/bin/pytest -q` |
| `Mutiny_backend_private/` | `cd Mutiny_backend_private && npm test` |
| `frontend/` | `cd frontend && npm run typecheck && npm run lint && npm test && npm run build` |
| `shared/` | `node shared/sync.mjs` (rewrites the copies), then the checks for all three apps |

The agent's tests start the MongoDB that the API's `npm install` downloaded, so do step 1 first.
`npm run build` downloads two fonts from Google Fonts, so it needs the internet.

## Rules

- **Never commit secrets or `.env` files.** Use the `.env.example` files, and keep real keys local.
- **One change per pull request**, with a description of what it does and how you checked it. UI
  changes need a screenshot.
- **Bugs and security:** a fix comes with a test that fails without it. Report a vulnerability
  privately to the maintainers, not in a public issue.
- **The look:** true black, one dark theme, Geist in the app, text at 13 px or larger, and the
  landing page stays as it is. Don't add a UI library or a heavy dependency without asking first.
- **The agent:** model calls go through `agent/app/models/llm.py`, founder text only to the allowed
  providers, and new behaviour gets a fake-model test. Never call a paid API from a test.
- **Files the generator owns:** don't edit the generated copies of `shared/` data by hand (CI checks).
- **CI and repo settings** (`.github/`) are changed by maintainers only.
