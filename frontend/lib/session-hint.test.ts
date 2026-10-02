// node --test lib/session-hint.test.ts
import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

// A Map-backed stand-in for the browser's storage; `broken` makes every call throw (private mode).
class FakeStorage {
  data = new Map<string, string>()
  broken = false
  getItem(k: string) { if (this.broken) throw new Error("blocked"); return this.data.get(k) ?? null }
  setItem(k: string, v: string) { if (this.broken) throw new Error("blocked"); this.data.set(k, v) }
  removeItem(k: string) { if (this.broken) throw new Error("blocked"); this.data.delete(k) }
}
const session = new FakeStorage()
const local = new FakeStorage()
Object.defineProperty(globalThis, "sessionStorage", { value: session, configurable: true })
Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true })

const { forgetSession, hadSession, isPublicPath, pickStoredUser, readLastUser, rememberUser } = await import("./session-hint.ts")

beforeEach(() => {
  session.data.clear()
  local.data.clear()
  session.broken = local.broken = false
})

const me = {
  id: "u1", name: "Fiona", email: "f@x.test", role: "Founder", isAdmin: false, ghostMode: undefined,
  hasPassword: true, emailVerified: true, avatarUrl: null, plan: "pro", authProviders: ["google"],
}

test("only the fields the shell draws are kept", () => {
  assert.deepEqual(pickStoredUser(me), {
    id: "u1", name: "Fiona", email: "f@x.test", role: "Founder", isAdmin: false, hasPassword: true, emailVerified: true, avatarUrl: null,
  })
})

test("a confirmed user is remembered for the tab and marks the browser; signing out forgets both", () => {
  assert.equal(hadSession(), false)
  assert.equal(readLastUser(), null)
  rememberUser(me)
  assert.equal(hadSession(), true)
  assert.deepEqual(readLastUser(), pickStoredUser(me))
  forgetSession()
  assert.equal(hadSession(), false)
  assert.equal(readLastUser(), null)
})

test("anything but a stored user with an id and a role reads as nobody", () => {
  session.data.set("something:last-user", "{not json")
  assert.equal(readLastUser(), null)
  session.data.set("something:last-user", JSON.stringify({ name: "No id" }))
  assert.equal(readLastUser(), null)
})

test("blocked storage never throws, and counts as maybe signed in (public pages still ask)", () => {
  session.broken = local.broken = true
  assert.doesNotThrow(() => rememberUser(me))
  assert.doesNotThrow(() => forgetSession())
  assert.equal(readLastUser(), null)
  assert.equal(hadSession(), true)
})

test("public pages are the landing and the terms", () => {
  assert.equal(isPublicPath("/"), true)
  assert.equal(isPublicPath("/terms"), true)
  assert.equal(isPublicPath("/login"), false)
  assert.equal(isPublicPath("/founder"), false)
})
