// The review as the page shows it, and how one streamed event changes it. Pure (no requests), so
// node --test can run it; lib/agent-transport.ts re-exports all of it next to the calls.
import type { SSEEvent } from "./sse-parse"

export type Reader = "something" | "nothing"
export type RiskStatus = "open" | "accepted" | "resolved" | "stands" | "needs_test" | "disputed"
export type VerdictLabel = "needs_evidence" | "almost_there" | "ready"

export type Risk = {
  id: string
  category: string
  categoryLabel: string
  title: string
  why: string
  quote: string | null
  founderStated: boolean
  split: { agree: number; of: number; text: string }
  test: { text: string; effort: "hours" | "days" | "weeks" }
  criteria: string
  status: RiskStatus
  statusText: string
  ruling: string | null
}

export type NothingView = {
  verdict: { label: VerdictLabel; text: string; meaning: string; about: string }
  risks: Risk[]
  cannotJudge: string
}

export type SomethingView = {
  strengths: { text: string }[]
  concessions: string[]
  address: { riskId: string; text: string }[]
  nextProof: string
  unavailable?: boolean
}

export type ReviewView = {
  reviewId: string
  status: "running" | "awaiting_reaction" | "complete" | "failed"
  readers: Reader[]
  subject: "saved_idea" | "typed_text"
  ideaId: string | null
  round: number
  maxRounds: number
  brief: { oneLiner: string; claims: { id: string; text: string; founderStated: boolean }[]; unknowns: string[] } | null
  nothing: NothingView | null
  something: SomethingView | null
  error: { code: string; message: string; retryable: boolean } | null
  /** On views read from the server: the id of the newest event when the view was read. A stream
   *  resumed after it brings everything newer, and none of the old pauses. */
  lastEventId?: number
}

export type Progress = { stage: string; text: string } | null

export function initialView(reviewId: string, readers: Reader[], subject: ReviewView["subject"], ideaId: string | null): ReviewView {
  return { reviewId, status: "running", readers, subject, ideaId, round: 0, maxRounds: 2, brief: null, nothing: null, something: null, error: null }
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown) => (typeof v === "string" ? v : "")
const withText = (v: unknown): v is { text: string } => typeof (v as { text?: unknown } | null)?.text === "string"

// A partial `reader` event must not leave holes the page reads straight through (`strengths.length`
// on {}): Something's lists default to empty, and a Nothing without its verdict or risks is skipped.
function somethingOf(d: Record<string, unknown>): SomethingView {
  return {
    strengths: list(d.strengths).filter(withText),
    concessions: list(d.concessions).filter((c): c is string => typeof c === "string"),
    address: list(d.address).filter((a): a is { riskId: string; text: string } => withText(a) && typeof (a as { riskId?: unknown }).riskId === "string"),
    nextProof: str(d.nextProof),
    ...(d.unavailable ? { unavailable: true } : {}),
  }
}

function nothingOf(d: Record<string, unknown>): NothingView | null {
  const v = d.verdict as Partial<NothingView["verdict"]> | null | undefined
  if (!v || typeof v !== "object" || !Array.isArray(d.risks)) return null
  const risks = d.risks.filter((r): r is Risk => {
    const x = r as Partial<Risk> | null
    return Boolean(x && typeof x.id === "string" && x.split && typeof x.split === "object" && x.test && typeof x.test === "object")
  })
  return {
    verdict: { label: v.label ?? "needs_evidence", text: str(v.text), meaning: str(v.meaning), about: str(v.about) },
    risks,
    cannotJudge: str(d.cannotJudge),
  }
}

/** One event into the view. Returns the new view, the progress line, and whether the stream ended. */
export function applyEvent(view: ReviewView, ev: SSEEvent): { view: ReviewView; progress?: Progress; ended: boolean } {
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(ev.data || "{}") ?? {} } catch { data = {} }
  switch (ev.event) {
    case "progress":
      return { view, progress: { stage: String(data.stage), text: String(data.text) }, ended: false }
    case "brief":
      return { view: { ...view, brief: data as unknown as ReviewView["brief"] }, ended: false }
    case "reader": {
      if (data.reader === "something") return { view: { ...view, something: somethingOf(data) }, ended: false }
      const nothing = data.reader === "nothing" ? nothingOf(data) : null
      return { view: nothing ? { ...view, nothing } : view, ended: false }
    }
    case "ruling": {
      const r = data as { riskId: string; status: RiskStatus; statusText: string; ruling: string | null; round: number }
      const nothing = view.nothing && {
        ...view.nothing,
        risks: view.nothing.risks.map((x) => (x.id === r.riskId ? { ...x, status: r.status, statusText: r.statusText, ruling: r.ruling } : x)),
      }
      return { view: { ...view, nothing, round: r.round ?? view.round }, ended: false }
    }
    case "interrupt":
      return { view: { ...view, status: "awaiting_reaction", maxRounds: Number(data.maxRounds ?? view.maxRounds) }, progress: null, ended: true }
    case "complete":
      return { view: { ...view, status: "complete" }, progress: null, ended: true }
    case "error":
      return { view: { ...view, status: "failed", error: data as unknown as ReviewView["error"] }, progress: null, ended: true }
    default:
      return { view, ended: false }
  }
}

/** The agent closes the stream after each of these. */
export const isTerminal = (ev: SSEEvent) => ev.event === "interrupt" || ev.event === "complete" || ev.event === "error"

/** The event's id (the run's event number), or null when it has no usable one. */
export function seqOf(ev: SSEEvent): number | null {
  const n = ev.id ? Number(ev.id) : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * Whether an event ends a follow. The agent replays every stored event after `?after=`, and a
 * review pauses (`interrupt`) once per reaction, so resuming from an id that is behind brings old
 * pauses back. `complete` and `error` always end it (nothing comes after them); a pause only when
 * it is newer than `known`, the newest one the caller already has. `known = Infinity` follows
 * through every pause, for a caller that can't tell which one is the newest.
 */
export function endsFollow(ev: SSEEvent, known: number): boolean {
  if (ev.event === "complete" || ev.event === "error") return true
  if (ev.event !== "interrupt") return false
  const seq = seqOf(ev)
  return seq === null || seq > known // without an id it can't be a replay we know
}
