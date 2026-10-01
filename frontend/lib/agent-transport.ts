// Every call to the review (Something + Nothing) goes through here. The browser only talks to
// Node, which checks the login and forwards to the agent. A review streams its steps as SSE;
// if the stream drops, we reconnect from the last event id, and after three failures we fall
// back to polling. Events and polling build the same ReviewView.
import apiClient, { API_BASE_URL } from "@/lib/axios"
import { SSEParser, type SSEEvent } from "@/lib/sse-parse"

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
}

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

export function initialView(reviewId: string, readers: Reader[], subject: ReviewView["subject"], ideaId: string | null): ReviewView {
  return { reviewId, status: "running", readers, subject, ideaId, round: 0, maxRounds: 2, brief: null, nothing: null, something: null, error: null }
}

export type Progress = { stage: string; text: string } | null

/** One event into the view. Returns the new view, the progress line, and whether the stream ended. */
export function applyEvent(view: ReviewView, ev: SSEEvent): { view: ReviewView; progress?: Progress; ended: boolean } {
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(ev.data || "{}") } catch { data = {} }
  switch (ev.event) {
    case "progress":
      return { view, progress: { stage: String(data.stage), text: String(data.text) }, ended: false }
    case "brief":
      return { view: { ...view, brief: data as unknown as ReviewView["brief"] }, ended: false }
    case "reader":
      return data.reader === "nothing"
        ? { view: { ...view, nothing: data as unknown as NothingView }, ended: false }
        : { view: { ...view, something: data as unknown as SomethingView }, ended: false }
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

type Follow = {
  after: number
  onEvent: (ev: SSEEvent) => void
  onPoll: (view: ReviewView) => void
  signal: AbortSignal
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => { clearTimeout(t); resolve() }, { once: true })
  })

/** Follows a review until it pauses for the founder, finishes or fails. Returns the last event id. */
export async function followReview(id: string, { after, onEvent, onPoll, signal }: Follow): Promise<number> {
  let last = after
  let failures = 0
  let refreshed = false
  while (!signal.aborted && failures < 3) {
    try {
      const res = await fetch(`${API_BASE_URL}/agent/reviews/${id}/stream?after=${last}`, {
        credentials: "include", headers: { accept: "text/event-stream", ...tzHeader() }, signal,
      })
      if (res.status === 401 && !refreshed) {
        refreshed = true
        try {
          await apiClient.post("/auth/refresh")
        } catch {
          window.dispatchEvent(new Event("auth:expired"))
          return last
        }
        continue
      }
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const parser = new SSEParser()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        for (const ev of parser.push(decoder.decode(value, { stream: true }))) {
          if (ev.id) last = Number(ev.id)
          onEvent(ev)
          if (ev.event === "interrupt" || ev.event === "complete" || ev.event === "error") return last
        }
      }
      failures += 1 // the stream ended without a terminal event: reconnect from `last`
    } catch {
      if (signal.aborted) return last
      failures += 1
    }
    await sleep(500 * 2 ** failures, signal)
  }
  // Streaming kept failing: poll the stored view until the review stops running.
  while (!signal.aborted) {
    try {
      const view = await reviewsApi.get(id)
      onPoll(view)
      if (view.status !== "running") return last
    } catch {
      // keep trying quietly; the page shows the last view it has
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
