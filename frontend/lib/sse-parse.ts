// A small Server-Sent Events parser for fetch() streams (EventSource can't send a POST or reuse
// our 401-refresh flow). Feed it decoded text chunks; it returns complete events. Handles
// id/event/multi-line data fields, ":" comment lines (keep-alive pings) and \r\n line endings.

export type SSEEvent = { id: string | null; event: string; data: string }

export class SSEParser {
  private buffer = ""

  push(chunk: string): SSEEvent[] {
    this.buffer += chunk.replace(/\r\n?/g, "\n")
    const events: SSEEvent[] = []
    let sep = this.buffer.indexOf("\n\n")
    while (sep !== -1) {
      const block = this.buffer.slice(0, sep)
      this.buffer = this.buffer.slice(sep + 2)
      const ev = parseBlock(block)
      if (ev) events.push(ev)
      sep = this.buffer.indexOf("\n\n")
    }
    return events
  }
}

function parseBlock(block: string): SSEEvent | null {
  let id: string | null = null
  let event = "message"
  const data: string[] = []
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue
    const i = line.indexOf(":")
    const field = i === -1 ? line : line.slice(0, i)
    let value = i === -1 ? "" : line.slice(i + 1)
    if (value.startsWith(" ")) value = value.slice(1)
    if (field === "id") id = value
    else if (field === "event") event = value
    else if (field === "data") data.push(value)
  }
  if (!data.length && id === null) return null
  return { id, event, data: data.join("\n") }
}
