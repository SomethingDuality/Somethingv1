"""A stand-in for Node's internal listener (/internal/*), so Python tests don't need Node.
It mirrors the contract in Mutiny_backend_private/src/controllers/internal.controller.js."""
import json

import httpx


class FakeNode:
    def __init__(self, key: str | None = "test-agent-to-node") -> None:
        self.key = key  # None accepts any key (evals run with the real agent/.env)
        self.users: dict[str, dict] = {}
        self.ideas: dict[str, dict] = {}
        self.updates: list[dict] = []
        self.notifications: list[dict] = []
        self.questions: dict[str, dict] = {}
        self.fail_next: int = 0
        self.public_ideas: list[dict] = []    # /internal/match/ideas
        self.match_people: dict[str, dict] = {}  # /internal/match/user/:id
        self.requests: list[str] = []           # every path asked, in order (tests count calls)

    def add_user(self, user_id: str, role: str = "Founder", **fields) -> None:
        self.users[user_id] = {"_id": user_id, "role": role, "fields": dict(fields), "fieldSources": {}}

    def add_idea(self, idea_id: str, founder_id: str, **fields) -> None:
        self.ideas[idea_id] = {"_id": idea_id, "founder_id": founder_id, "fields": dict(fields), "fieldSources": {},
                               "milestones": fields.pop("milestones", []), "updates": [], "attachments": []}

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def _handle(self, req: httpx.Request) -> httpx.Response:
        if self.key is not None and req.headers.get("x-agent-key") != self.key:
            return httpx.Response(401, json={"message": "bad key"})
        if self.fail_next:
            self.fail_next -= 1
            return httpx.Response(503, json={"message": "down"})
        path = req.url.path
        self.requests.append(path)
        body = json.loads(req.content) if req.content else {}
        if req.method == "GET" and path.startswith("/internal/context/"):
            user_id = path.rsplit("/", 1)[1]
            user = self.users.get(user_id)
            if not user:
                return httpx.Response(404, json={})
            out = {"user": {"id": user_id, "role": user["role"], "fields": user["fields"], "fieldSources": user["fieldSources"]}}
            idea_id = req.url.params.get("ideaId")
            if idea_id:
                idea = self.ideas.get(idea_id)
                if not idea or idea["founder_id"] != user_id:
                    return httpx.Response(404, json={})
                out["idea"] = {"id": idea_id, "fields": idea["fields"], "fieldSources": idea["fieldSources"],
                               "milestones": idea["milestones"], "updates": idea["updates"], "attachments": idea["attachments"]}
            return httpx.Response(200, json=out)
        if req.method == "POST" and path == "/internal/apply-update":
            self.updates.append(body)
            target = self.ideas.get(body.get("entityId")) if body.get("entity") == "idea" else self.users.get(body["userId"])
            if target is None:
                return httpx.Response(404, json={})
            target["fields"].update(body["patch"])
            for k in body["patch"]:
                target["fieldSources"][k.replace(".", "__")] = {"source": "agent", "at": "now"}
            return httpx.Response(200, json={"ok": True, "fields": list(body["patch"])})
        if req.method == "POST" and path == "/internal/notify":
            if any(n["key"] == body["key"] for n in self.notifications):
                return httpx.Response(200, json={"ok": True, "duplicate": True})
            self.notifications.append(body)
            return httpx.Response(200, json={"ok": True})
        if path.startswith("/internal/questions/"):
            qid = path.rsplit("/", 1)[1]
            if req.method == "PUT":
                self.questions[qid] = body
            else:
                self.questions.pop(qid, None)
            return httpx.Response(200, json={"ok": True})
        if path == "/internal/match/ideas":
            return httpx.Response(200, json={"ideas": list(self.public_ideas)})
        if path.startswith("/internal/match/user/"):
            uid = path.rsplit("/", 1)[1]
            return httpx.Response(200, json=self.match_people[uid]) if uid in self.match_people else httpx.Response(404, json={})
        if path == "/internal/match/users":
            role, after = req.url.params.get("role"), req.url.params.get("after")
            ids = sorted(k for k, v in self.match_people.items() if v["role"] == role)
            return httpx.Response(200, json={"ids": [i for i in ids if not after or i > after][:500]})
        if path == "/internal/health":
            return httpx.Response(200, json={"status": "ok"})
        return httpx.Response(404, json={})
