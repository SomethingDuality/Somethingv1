// node --test lib/format.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { dateLabel, money, when } from "./format.ts"

// The formatting the cached formatters replaced, kept here as the reference.
const oldDateLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) })
const oldMoney = (n: number | null | undefined) => `$${Number(n || 0).toLocaleString("en-US")}`

test("dates read the same as with toLocaleDateString, this year and others", () => {
  const year = new Date().getFullYear()
  const dates = [
    new Date(year, 0, 1), new Date(year, 9, 2, 13, 5), new Date(year, 11, 31, 23, 59),
    new Date(2025, 1, 28), new Date(2024, 1, 29), new Date(1999, 6, 4), new Date(year + 1, 4, 9),
  ]
  for (const d of dates) {
    assert.equal(dateLabel(d), oldDateLabel(d))
    assert.equal(dateLabel(d.toISOString()), oldDateLabel(new Date(d.toISOString())))
  }
  assert.equal(dateLabel(null), "")
  assert.equal(dateLabel("not a date"), "")
  // Older than a week falls through to the date.
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  assert.equal(when(old), oldDateLabel(old))
})

test("money reads the same as with toLocaleString, and the short forms are unchanged", () => {
  for (const n of [0, 1, 999, 1000, 1500, 21800, 1234567, 0.5, 1234.5678, -2500, 1e9, null, undefined, NaN]) {
    assert.equal(money(n), oldMoney(n))
  }
  assert.equal(money(1_200_000, { short: true }), "$1.2M")
  assert.equal(money(2_000_000, { short: true }), "$2M")
  assert.equal(money(45_000, { short: true }), "$45k")
  assert.equal(money(9_999, { short: true }), "$9,999")
})
