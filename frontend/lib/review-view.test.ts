// node --test lib/review-view.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { applyEvent, endsFollow, initialView } from "./review-view.ts"

const ev = (event: string, id: number | null, data: unknown = {}) => ({ id: id === null ? null : String(id), event, data: JSON.stringify(data) })

test("a pause ends a follow only when it is newer than the newest one the caller has", () => {
  assert.equal(endsFollow(ev("interrupt", 12), 0), true)
  assert.equal(endsFollow(ev("interrupt", 12), 12), false) // replayed
  assert.equal(endsFollow(ev("interrupt", 5), 12), false) // an older round, replayed
  assert.equal(endsFollow(ev("interrupt", 40), Infinity), false) // following through every pause
  assert.equal(endsFollow(ev("ruling", 13), 0), false)
})

test("a pause without a usable id ends the follow (it can't be a known replay)", () => {
  assert.equal(endsFollow(ev("interrupt", null), Infinity), true)
  assert.equal(endsFollow({ id: "x", event: "interrupt", data: "{}" }, Infinity), true)
})

test("complete and error end a follow even when replayed", () => {
  assert.equal(endsFollow(ev("complete", 3), Infinity), true)
  assert.equal(endsFollow(ev("error", 3), 9), true)
})

test("an empty or partial reader event leaves nothing the page can trip on", () => {
  const view = initialView("r1", ["something", "nothing"], "typed_text", null)
  assert.equal(applyEvent(view, ev("reader", 1, {})).view, view)
  assert.equal(applyEvent(view, ev("reader", 1, { reader: "nothing", risks: [] })).view, view) // no verdict
  assert.deepEqual(applyEvent(view, ev("reader", 1, { reader: "something" })).view.something,
    { strengths: [], concessions: [], address: [], nextProof: "" })
  const nothing = applyEvent(view, ev("reader", 1, {
    reader: "nothing", verdict: { label: "almost_there", text: "Almost there" }, risks: [{ id: "a1" }, null],
  })).view.nothing
  assert.deepEqual(nothing?.risks, []) // a risk without its split and test isn't shown
  assert.equal(nothing?.verdict.meaning, "")
  assert.equal(applyEvent(view, { id: "1", event: "reader", data: "not json" }).view, view)
})

test("applyEvent doesn't change the view it was given", () => {
  const view = initialView("r1", ["nothing"], "typed_text", null)
  const before = structuredClone(view)
  const out = applyEvent(view, ev("interrupt", 4, { maxRounds: 3 }))
  assert.deepEqual(view, before)
  assert.equal(out.ended, true)
  assert.equal(out.view.status, "awaiting_reaction")
  assert.equal(out.view.maxRounds, 3)
})
