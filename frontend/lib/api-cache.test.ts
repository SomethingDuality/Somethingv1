// node --test lib/api-cache.test.ts
import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"

// The module imports "@/lib/axios" like the app does; map "@/" to this folder for Node.
// (registerHooks is Node 23.5+; the installed @types/node predates it.)
type Resolve = (specifier: string, context: object, next: (specifier: string, context: object) => unknown) => unknown
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: Resolve }) => void }
const root = new URL("../", import.meta.url)
registerHooks({
  resolve: (specifier, context, next) =>
    next(specifier.startsWith("@/") ? new URL(`${specifier.slice(2)}.ts`, root).href : specifier, context),
})

// The cache only works in a browser: a window that takes event listeners is enough.
const win = Object.assign(new EventTarget(), { location: { pathname: "/investor" } })
Object.assign(globalThis, { window: win })

const { cached, cachedGet, clearCache, invalidate, setCacheOwner, staleAfter } = await import("./api-cache.ts")
const { default: apiClient } = await import("./axios.ts")

let calls: string[] = []
let answer: unknown = { n: 1 }
beforeEach(() => {
  calls = []
  answer = { n: 1 }
  clearCache()
  setCacheOwner("user-a")
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url).replace(/^https?:\/\/[^/]+/, ""))
    return new Response(JSON.stringify(answer), { status: 200 })
  }) as typeof fetch
})

const collect = async (url: string) => {
  const seen: unknown[] = []
  await cachedGet(url, (d) => seen.push(d))
  return seen
}

test("the first read asks; a second within 30 s is answered from the cache without asking", async () => {
  assert.deepEqual(await collect("/ideas/user"), [{ n: 1 }])
  assert.deepEqual(await collect("/ideas/user"), [{ n: 1 }])
  assert.equal(calls.length, 1)
  assert.deepEqual(cached("/ideas/user"), { n: 1 })
})

test("two readers at once share one request", async () => {
  const [a, b] = await Promise.all([collect("/investor/portfolio"), collect("/investor/portfolio")])
  assert.deepEqual(a, [{ n: 1 }])
  assert.deepEqual(b, [{ n: 1 }])
  assert.equal(calls.length, 1)
})

test("after a write, the old answer paints first and the new one follows", async () => {
  await collect("/investor/watchlist")
  await apiClient.post("/investor/watchlist/abc", {})
  answer = { n: 2 }
  assert.deepEqual(await collect("/investor/watchlist"), [{ n: 1 }, { n: 2 }])
  // Unchanged on the next check: painted once, not twice.
  invalidate("/investor/watchlist")
  assert.deepEqual(await collect("/investor/watchlist"), [{ n: 2 }])
})

test("another user, or none, never sees the last one's answers", async () => {
  await collect("/founder/profile")
  setCacheOwner("user-b")
  assert.equal(cached("/founder/profile"), undefined)
  assert.deepEqual(await collect("/founder/profile"), [{ n: 1 }])
  assert.equal(calls.length, 2)

  win.dispatchEvent(new Event("auth:expired"))
  await collect("/founder/profile")
  assert.equal(cached("/founder/profile"), undefined) // signed out: nothing is kept
})

test("GET /ideas/:id (it counts a view) and anything not listed always go to the server", async () => {
  await collect("/ideas/0123456789abcdef01234567")
  await collect("/ideas/0123456789abcdef01234567")
  await collect("/notifications")
  await collect("/notifications")
  assert.equal(calls.length, 4)
  assert.equal(cached("/ideas/0123456789abcdef01234567"), undefined)
})

test("a failed check keeps what is shown; with nothing to show, it rejects", async () => {
  await collect("/agent/deal-flow")
  invalidate("/agent/deal-flow")
  globalThis.fetch = (async () => { throw new TypeError("offline") }) as typeof fetch
  assert.deepEqual(await collect("/agent/deal-flow"), [{ n: 1 }])
  await assert.rejects(collect("/ideas/discover"))
})

test("what a write makes stale", () => {
  assert.deepEqual(staleAfter("/auth/refresh"), [])
  assert.deepEqual(staleAfter("/ideas/abc/like"), ["/ideas/", "/leaderboards/", "/agent/deal-flow"])
  assert.deepEqual(staleAfter("/investor/commit"), ["/investor/watchlist", "/investor/portfolio", "/agent/deal-flow"])
  assert.deepEqual(staleAfter("/investor/interests"), ["/investor/profile", "/agent/deal-flow"])
  assert.deepEqual(staleAfter("/threads/abc/messages"), [])
})
