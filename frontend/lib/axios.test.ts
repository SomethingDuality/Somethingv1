// node --test lib/axios.test.ts
import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import apiClient, { API_BASE_URL, ApiError, buildUrl, encodeParams, onMutation } from "./axios.ts"

type Call = { url: string; method: string; headers: Headers; body: unknown; credentials?: string }
let calls: Call[] = []
let reply: (call: Call) => Response | Promise<Response>

beforeEach(() => {
  calls = []
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const call = { url, method: init.method ?? "GET", headers: new Headers(init.headers), body: init.body, credentials: init.credentials }
    calls.push(call)
    return reply(call)
  }) as typeof fetch
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

test("params become the query string: skipped when empty, appended to one already there", () => {
  assert.equal(encodeParams({ tz: "Asia/Kolkata", context: undefined, after: null }), "tz=Asia%2FKolkata")
  assert.equal(encodeParams({ q: "a b&c", ids: ["1", "2"] }), "q=a+b%26c&ids%5B%5D=1&ids%5B%5D=2")
  assert.equal(encodeParams({ at: new Date("2026-10-02T10:00:00Z") }), "at=2026-10-02T10%3A00%3A00.000Z")
  assert.equal(encodeParams({}), "")
  assert.equal(buildUrl("/threads/1/messages", {}), `${API_BASE_URL}/threads/1/messages`)
  assert.equal(buildUrl("/teams/invites?box=outgoing", { page: 2 }), `${API_BASE_URL}/teams/invites?box=outgoing&page=2`)
  assert.equal(buildUrl("https://example.test/x", { a: 1 }), "https://example.test/x?a=1")
})

test("a GET sends cookies and params, and resolves { data, status, headers }", async () => {
  reply = () => json({ ok: true })
  const res = await apiClient.get<{ ok: boolean }>("/agent/reviews/latest", { params: { ideaId: "abc" } })
  assert.deepEqual(res.data, { ok: true })
  assert.equal(res.status, 200)
  assert.equal(res.headers["content-type"], "application/json")
  assert.equal(calls[0].url, `${API_BASE_URL}/agent/reviews/latest?ideaId=abc`)
  assert.equal(calls[0].method, "GET")
  assert.equal(calls[0].credentials, "include")
  assert.equal(calls[0].body, undefined)
})

test("objects go as JSON; FormData goes as is, without a Content-Type (the browser adds the boundary)", async () => {
  reply = () => json({})
  await apiClient.post("/ideas", { title: "Late-night meals" })
  assert.equal(calls[0].body, JSON.stringify({ title: "Late-night meals" }))
  assert.equal(calls[0].headers.get("content-type"), "application/json")

  const fd = new FormData()
  fd.append("avatar", new Blob(["x"]), "a.png")
  await apiClient.post("/founder/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } })
  assert.equal(calls[1].body, fd)
  assert.equal(calls[1].headers.get("content-type"), null)

  // No data, no body and no Content-Type (a simple request: no CORS preflight).
  await apiClient.post("/auth/logout")
  assert.equal(calls[2].body, undefined)
  assert.equal(calls[2].headers.get("content-type"), null)

  // DELETE takes its body from config.data, like axios.
  await apiClient.delete("/auth/account", { data: { confirmEmail: "a@b.c" } })
  assert.equal(calls[3].method, "DELETE")
  assert.equal(calls[3].body, JSON.stringify({ confirmEmail: "a@b.c" }))
})

test("a non-2xx rejects with response.{status,data}; an unreachable server with code ERR_NETWORK", async () => {
  reply = () => json({ message: "Keep it under 2000 characters" }, 400)
  const err = await apiClient.post("/agent/chat", { text: "x" }).catch((e) => e)
  assert.ok(err instanceof ApiError)
  assert.ok(err instanceof Error)
  assert.equal(err.response?.status, 400)
  assert.deepEqual(err.response?.data, { message: "Keep it under 2000 characters" })
  assert.equal(err.config.url, "/agent/chat")
  assert.equal(err.message, "Request failed with status code 400")

  reply = () => new Response("Not here", { status: 404 })
  const notFound = await apiClient.get("/ideas/x").catch((e) => e)
  assert.equal(notFound.response.status, 404)
  assert.equal(notFound.response.data, "Not here")

  reply = () => { throw new TypeError("Failed to fetch") }
  const offline = await apiClient.get("/inbox/summary").catch((e) => e)
  assert.equal(offline.code, "ERR_NETWORK")
  assert.equal(offline.response, undefined)
})

test("401s at once share one refresh, then each request goes again once", async () => {
  let session = "old"
  reply = (call) => {
    if (call.url.endsWith("/auth/refresh")) {
      session = "new"
      return new Response(null, { status: 204 })
    }
    return session === "new" ? json({ url: call.url }) : json({ message: "expired" }, 401)
  }
  const [a, b] = await Promise.all([apiClient.get("/ideas/user"), apiClient.get("/founder/profile")])
  assert.equal(a.data.url, `${API_BASE_URL}/ideas/user`)
  assert.equal(b.data.url, `${API_BASE_URL}/founder/profile`)
  assert.equal(calls.filter((c) => c.url.endsWith("/auth/refresh")).length, 1)
  assert.equal(calls.length, 5) // two 401s, one refresh, two retries
})

test("a refused refresh rejects the request with the refresh's error, without a second retry", async () => {
  reply = () => json({ message: "signed out" }, 401)
  const err = await apiClient.get("/auth/me").catch((e) => e)
  assert.equal(err.response.status, 401)
  assert.equal(err.config.url, "/auth/refresh")
  assert.equal(calls.length, 2) // /auth/me, /auth/refresh: the refresh itself never refreshes
})

test("successful writes are announced (the GET cache listens), reads and failures aren't", async () => {
  const seen: string[] = []
  const off = onMutation((method, url) => seen.push(`${method} ${url}`))
  reply = () => json({})
  await apiClient.get("/ideas/user")
  await apiClient.post("/investor/watchlist/abc?x=1", {})
  reply = () => json({}, 500)
  await apiClient.put("/ideas/abc", {}).catch(() => {})
  off()
  assert.deepEqual(seen, ["post /investor/watchlist/abc"])
})
