// node --test lib/next-path.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { sameSitePath } from "./next-path.ts"

const origin = "https://something.test"

test("a path on this site comes back with its query", () => {
  assert.equal(sameSitePath("/founder/chats?thread=abc", origin), "/founder/chats?thread=abc")
  assert.equal(sameSitePath("/investor", origin), "/investor")
})

test("anything that leaves the site is refused", () => {
  // What URLSearchParams.get returns for ?next=/%5Cevil.com, and the other usual tricks.
  for (const next of ["/\\evil.com", "//evil.com", "/\\/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", null]) {
    assert.equal(sameSitePath(next, origin), null, String(next))
  }
  assert.equal(sameSitePath(new URLSearchParams("next=/%5Cevil.com").get("next"), origin), null)
})
