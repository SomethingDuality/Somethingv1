import apiClient from "@/lib/axios"

export type QuestionOption = { value: string; label: string }

export type Question = {
  id: string
  /** confirm: the agent checks a change before remembering it ("Stage: Prototype → MVP, right?"). */
  type: "chips" | "text" | "yes_no" | "confirm"
  prompt: string
  help?: string
  placeholder?: string
  format?: "url" | "handle" | "long"
  maxLength?: number
  options?: QuestionOption[]
  suggestions?: string[]
  select?: { min: number; max: number }
  allowCustom: boolean
  entity: "user" | "idea"
  entityId: string | null
  entityLabel: string | null
  reason: "daily" | "jit" | "more" | "confirm"
  /** "agent" for the agent's confirms; bank questions leave it out. */
  origin?: "agent"
  context: string | null
  contextLabel: string | null
  /** Labels of the features this answer helps (e.g. "Investor matching"). */
  helpsWith?: string[]
}

export type NextResponse = {
  question: Question | null
  reason?: "paused" | "done_today" | "nothing_left" | "jit_cap"
  nextEligibleAt?: string | null
}

export type SkipMode = "later" | "skip" | "never"

/** A confirm's answer: yes, or what's right instead. */
export type ConfirmAnswer = { choice: "yes" } | { choice: "change"; value: string }
export type AnswerValue = string | string[] | ConfirmAnswer

/** How far along the user is: all questions that apply to them, and per area (what they unlock). */
export type Progress = {
  answered: number
  total: number
  areas: { id: string; label: string; answered: number; total: number }[]
}

export type SkipResponse = {
  ok: boolean
  status: string
  snoozedUntil: string | null
  pausedUntil: string | null
}

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

export const questionsApi = {
  next: (context?: string) =>
    apiClient
      .get<NextResponse>("/questions/next", { params: { tz: tz(), ...(context ? { context } : {}) } })
      .then((r) => r.data),
  answer: (q: Question, value: AnswerValue) =>
    apiClient
      .post<{ ok: boolean; saved: { entity: string; entityId: string | null; fields: string[] } }>(
        `/questions/${encodeURIComponent(q.id)}/answer`,
        { value, entityId: q.entityId, context: q.context },
      )
      .then((r) => r.data),
  progress: () => apiClient.get<Progress>("/questions/progress").then((r) => r.data),
  /** No unprompted questions until the user's tomorrow; asking for one still works. */
  rest: () => apiClient.post<{ ok: boolean; pausedUntil: string }>("/questions/rest", {}).then((r) => r.data),
  skip: (q: Question, mode: SkipMode) =>
    apiClient
      .post<SkipResponse>(`/questions/${encodeURIComponent(q.id)}/skip`, { mode, entityId: q.entityId, context: q.context })
      .then((r) => r.data),
}
