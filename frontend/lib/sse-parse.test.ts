// node --test lib/sse-parse.test.ts (Node strips the types itself; no test framework needed).
import { test } from "node:test"
import assert from "node:assert/strict"
import { SSEParser } from "./sse-parse.ts"

test("parses events split across chunks, with ids, multi-line data and pings", () => {
  const p = new SSEParser()
  assert.deepEqual(p.push("id: 1\nevent: progress\nda"), [])
  const out = p.push('ta: {"v":1}\n\n: ping\n\nid: 2\r\nevent: reader\r\ndata: a\r\ndata: b\r\n\r\n')
  assert.deepEqual(out, [
    { id: "1", event: "progress", data: '{"v":1}' },
    { id: "2", event: "reader", data: "a\nb" },
  ])
})

test("a comment-only block is not an event", () => {
  assert.deepEqual(new SSEParser().push(": ping\n\n"), [])
})

test("an event without a name is a message", () => {
  assert.deepEqual(new SSEParser().push("data: x\n\n"), [{ id: null, event: "message", data: "x" }])
})

test("a \\r\\n split across two chunks is one line ending", () => {
  const p = new SSEParser()
  assert.deepEqual(p.push("id: 7\r"), [])
  assert.deepEqual(p.push("\nevent: interrupt\r\ndata: {}\r"), [])
  assert.deepEqual(p.push("\n\r\n"), [{ id: "7", event: "interrupt", data: "{}" }])
})

test("an empty chunk between \\r and \\n changes nothing", () => {
  const p = new SSEParser()
  p.push("data: a\r")
  assert.deepEqual(p.push(""), [])
  assert.deepEqual(p.push("\n\n"), [{ id: null, event: "message", data: "a" }])
})
