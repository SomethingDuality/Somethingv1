// Every call to the review (Something + Nothing) goes through here. The browser only talks to
// Node, which checks the login and forwards to the agent. A review streams its steps as SSE;
// if the stream drops, we reconnect from the last event id, and after three failures in a row we
// fall back to polling. Events and polling build the same ReviewView (lib/review-view.ts).
import apiClient, { API_BASE_URL, isAuthFailure, refreshSession } from "@/lib/axios"
import { SSEParser, type SSEEvent } from "@/lib/sse-parse"
import { endsFollow, isTerminal, seqOf, type Reader, type ReviewView } from "@/lib/review-view"

export { applyEvent, initialView, seqOf } from "@/lib/review-view"
export type { NothingView, Progress, Reader, ReviewView, Risk, RiskStatus, SomethingView, VerdictLabel } from "@/lib/review-view"

export type Quota = { used: number; limit: number; resetsAt: string }
export type ReviewStatus = { live: boolean; fakeModels?: boolean; quota?: Quota }
export type StartResult = { kind: "review"; reviewId: string; quota: Quota } | { kind: "general"; reply: string }
export type Reaction = { kind: "accept"; riskId: string } | { kind: "dispute"; riskId: string; text: string } | { kind: "done" }

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}
const tzHeader = () => ({ "x-user-tz": tz() })

export const reviewsApi = {
  status: () => apiClient.get<ReviewStatus>("/agent/reviews/status", { headers: tzHeader() }).then((r) => r.data).catch(() => ({ live: false })),
  start: (body: { ideaId?: string; text?: string; readers: Reader[] }) =>
    apiClient.post<StartResult>("/agent/reviews", body, { headers: tzHeader() }).then((r) => r.data),
  get: (id: string) => apiClient.get<{ review: ReviewView }>(`/agent/reviews/${id}`).then((r) => r.data.review),
  latest: (ideaId?: string) =>
    apiClient.get<{ review: ReviewView | null }>("/agent/reviews/latest", { params: ideaId ? { ideaId } : {} }).then((r) => r.data.review),
  react: (id: string, reaction: Reaction) => apiClient.post(`/agent/reviews/${id}/react`, reaction).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/agent/reviews/${id}`).then((r) => r.data),
}

type Follow = {
  /** The id of the newest event the caller has applied: the stream resumes after it. */
  after: number
  /** Pauses at or below this id are replays the caller already has and don't end the follow
   *  (see endsFollow). Infinity when the caller can't know the newest id. Defaults to `after`. */
  known?: number
  onEvent: (ev: SSEEvent) => void
  onPoll: (view: ReviewView) => void
  /** The review was deleted or isn't the caller's: following stops. */
  onGone?: () => void
  signal: AbortSignal
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => { clearTimeout(t); resolve() }, { once: true })
  })

// A 4xx that a retry won't change: the review is gone or isn't the caller's (401 refreshes first).
const gone = (status?: number) => status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429

/** Follows a review until it pauses for the founder, finishes or fails. Returns the last event id. */
export async function followReview(id: string, { after, known = after, onEvent, onPoll, onGone, signal }: Follow): Promise<number> {
  let last = after
  let failures = 0
  let refreshed = false
  while (!signal.aborted && failures < 3) {
    try {
      const res = await fetch(`${API_BASE_URL}/agent/reviews/${id}/stream?after=${last}`, {
        credentials: "include", headers: { accept: "text/event-stream", ...tzHeader() }, signal,
      })
      if (res.status === 401 && !refreshed) {
        try {
          await refreshSession()
        } catch (err) {
          if (isAuthFailure(err)) return last // signed out; refreshSession told the app
          throw err // offline or a 5xx: counts as a failed try
        }
        refreshed = true
        continue
      }
      if (gone(res.status)) {
        onGone?.()
        return last
      }
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
      refreshed = false // a long review can outlive the next sign-in cookie too
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const parser = new SSEParser()
      let paused = false
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (value.length) failures = 0 // it's alive (pings count): only drops in a row add up
        for (const ev of parser.push(decoder.decode(value, { stream: true }))) {
          const seq = seqOf(ev)
          if (seq !== null) last = Math.max(last, seq)
          onEvent(ev)
          if (endsFollow(ev, known)) return last
          paused = isTerminal(ev)
        }
      }
      if (paused) continue // the agent closes the stream after every pause: go on from this one
      failures += 1 // the stream ended without a terminal event: reconnect from `last`
    } catch {
      if (signal.aborted) return last
      failures += 1
    }
    if (failures < 3) await sleep(500 * 2 ** failures, signal)
  }
  // Streaming kept failing: poll the stored view until the review stops running.
  while (!signal.aborted) {
    try {
      const view = await reviewsApi.get(id)
      onPoll(view)
      if (view.status !== "running") return last
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (gone(status)) {
        onGone?.()
        return last
      }
      if (isAuthFailure(err)) return last
      // otherwise keep trying quietly; the page shows the last view it has
    }
    await sleep(3000, signal)
  }
  return last
}

// ---- Matched deal flow (every 7 days) ----------------------------------------------------------

export type MatchAction = "opened" | "saved" | "passed" | "asked"
export type DealFlowMatch = {
  id: string
  ideaId: string
  status: "new" | MatchAction
  reasons: string[]
  idea: {
    title: string
    excerpt: string
    sectors: string[]
    stage: string | null
    stageLabel: string | null
    raising: string | null
    raisingLabel: string | null
    lookingFor: string[]
    location: string
  }
}
export type DealFlow = {
  batch: { id: string; createdAt: string; nextAt: string; size: number }
  matches: DealFlowMatch[]
  need: string | null
  matcher: string | null
}

export const dealFlowApi = {
  get: () => apiClient.get<DealFlow>("/agent/deal-flow").then((r) => r.data),
  act: (matchId: string, action: MatchAction) => apiClient.post(`/agent/deal-flow/${matchId}`, { action }).then((r) => r.data),
  reach: (ideaId: string) =>
    apiClient.get<{ investors: number; founders: number; days: number }>(`/agent/ideas/${ideaId}/reach`).then((r) => r.data),
}

// ---- The Something chat (after a review) --------------------------------------------------------

export type ChatTurn =
  | { kind: "about_this" | "general" | "judge_request"; reply: string; riskIds?: string[]; quota?: Quota }
  | { kind: "new_idea" }
export type ChatMessage = { role: "founder" | "something"; text: string; at: string }

export const chatApi = {
  turn: (body: { text: string; reviewId?: string; ideaId?: string }) =>
    apiClient.post<ChatTurn>("/agent/chat", body, { headers: tzHeader() }).then((r) => r.data),
  history: (reviewId: string) =>
    apiClient.get<{ messages: ChatMessage[] }>("/agent/chat", { params: { reviewId } }).then((r) => r.data.messages),
}
