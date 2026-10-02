# Something

Something helps people with startup ideas find the people they need: a co-founder who can build, an investor who backs that kind of idea, or a community that has the problem the idea solves. Most of the time those introductions happen through who you already know. We want them to happen because of what you've actually built.

If this is your first time contributing to open source, you're in the right place. This page explains what the app does, how the code fits together, and how to get your first change merged, one step at a time.

## What the app does

A founder writes down an idea. Before anyone else sees it, two AI readers go through it. **Something** argues for the idea and points out what's strong about it. **Nothing** argues against it and asks the uncomfortable questions: who actually has this problem, would they pay, can it be built. The founder can reply to Nothing and push back with evidence.

When the founder is ready, they post the idea publicly with some proof of work, like a prototype or a first customer. Every 7 days, investors get a short list of public ideas that match what they invest in, and founders get ideas that are looking for their skills. People can also post problems they face, chat, and form teams.

## How the code fits together

The repo has four folders you'll care about.

| Folder | What it is | Language |
|---|---|---|
| `frontend/` | The website people see | TypeScript, Next.js, React, Tailwind |
| `Mutiny_backend_private/` | The API: accounts, ideas, chats, teams | JavaScript, Node.js, Express, MongoDB |
| `agent/` | The AI part: the two readers, memory, matching | Python, FastAPI, LangGraph |
| `shared/` | Lists all three use, like the sectors an idea can be in | JSON |

(The API folder has an old name; the product used to be called Mutiny.)

The browser only ever talks to the API. When something needs the AI, the API asks the agent and passes the answer back, so the agent is never open to the internet directly. The two AI readers run on fake answers when you develop locally, which means you don't need any paid AI keys to work on the project.

## Run it on your computer

You need [Git](https://git-scm.com/downloads), [Node.js 24](https://nodejs.org/) and [Python 3.12](https://www.python.org/downloads/). You don't need to install a database, because the API starts its own.

Open three terminal windows, one for each part, and start them in this order:

```bash
# 1. The API, on http://localhost:5050
cd Mutiny_backend_private
cp .env.example .env
npm install
npm run dev:memory
```

Open `Mutiny_backend_private/.env` and give `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` two different long random strings before you start it. Wait until the terminal prints `[dev:memory] seeded`.

```bash
# 2. The agent, on http://localhost:8000
cd agent
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
# 3. The website, on http://localhost:3000
cd frontend
npm install
npm run dev
```

Now open http://localhost:3000/login. There are two buttons, "Continue as test founder" and "Continue as test investor", so you can try both sides without making an account. The test data disappears when you stop the API, which is on purpose.

On Windows, use `copy` instead of `cp`, and `.venv\Scripts\pip` and `.venv\Scripts\uvicorn` instead of the `.venv/bin/` paths (or run everything inside [WSL](https://learn.microsoft.com/windows/wsl/install), which behaves like the commands above).

If something doesn't start, read the error in the terminal first; it usually names the missing piece. Still stuck? Open an issue and paste the error.

## Your first pull request

A pull request (PR) is how you suggest a change. You make the change in your own copy of the project, then ask us to pull it into ours.

1. **Find something to work on.** Issues labelled `good first issue` are a good start. If you want to fix something that has no issue yet, open one first and say what you plan to do, so nobody spends a weekend on the same thing.
2. **Fork the repo.** Click "Fork" at the top of the GitHub page. That gives you your own copy you can change freely.
3. **Clone your fork and make a branch.** A branch keeps your change separate from everything else:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Somethingv1.git
   cd Somethingv1
   git checkout -b fix-short-description
   ```
4. **Make your change, then run the checks** for the folders you touched. [CONTRIBUTING.md](CONTRIBUTING.md) lists the exact commands. If you fixed a bug, add a test that would have caught it.
5. **Save and send your change:**
   ```bash
   git add the/files/you/changed
   git commit -m "Fix the date on comments in the idea page"
   git push origin fix-short-description
   ```
6. **Open the pull request.** GitHub shows a "Compare & pull request" button on your fork. Fill in the short template: what you changed and how you checked it.

After you open it, our automatic checks (called CI) run the tests for the parts you changed. A green tick means they passed. A red cross means something broke; click "Details" to see which test failed, fix it, and push again to the same branch. The PR updates by itself. Then one of the maintainers reviews it, may ask for changes, and merges it.

Don't worry about getting it perfect the first time. Most PRs go through a round or two of changes, and asking questions in the PR is completely fine.

## A few rules

- **Never put passwords, keys or `.env` files in a commit.** Use the `.env.example` files as templates and keep your real values on your computer.
- Keep each PR about one thing. Three small PRs get reviewed much faster than one big one.
- Changes to the look of the app need a screenshot in the PR. The app uses a black background, one dark theme and the Geist font, and the landing page stays as it is.
- Tests never call a paid AI service; the agent has fake answers for that.
- If you find a security problem, tell a maintainer privately instead of opening a public issue.
- Be kind in issues and reviews. Everyone here is learning something.

## Words you'll see in the code

| Word | Meaning |
|---|---|
| Something / Nothing | The two AI readers: one argues for an idea, one against |
| Review | One run of both readers over an idea |
| Deal flow | The weekly list of matched ideas an investor gets |
| Ghost Mode | Investors can chat without showing their name until they choose to |
| Something box | The small helper in the corner that asks one question at a time |
| Memory | What the agent remembers about a founder and their ideas, so it doesn't ask twice |

## Getting help

Open an issue with your question, or comment on your pull request. The maintainers are [@Somay-kousis](https://github.com/Somay-kousis) and [@somelamedude-git](https://github.com/somelamedude-git).
