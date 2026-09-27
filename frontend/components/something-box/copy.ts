import type { Question } from "@/lib/questions"

// What Something says in the box. Kept apart from the components so the live view and the
// history (the same lines, once the user has replied) always read the same.

/** "Investor matching" → "investor matching" for use mid-sentence; names keep their capitals. */
export const inSentence = (label: string) =>
  /^(Something|NDAs)\b/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1)

/** "a", "a and b", "a, b and c" */
export const andList = (xs: string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`

const firstName = (name?: string | null) => (name || "").trim().split(/\s+/)[0] || ""
const withName = (text: string, name?: string | null) => {
  const first = firstName(name)
  return first ? `${text}, ${first}` : text
}

/** The feature an answer helps, if the question says. */
export const helpedArea = (q: Question) => q.contextLabel ?? q.helpsWith?.[0] ?? null

/** A line before the question: why it's asked now, or hello for the first one. */
export function leadIn(q: Question, { first, name }: { first: boolean; name?: string | null }) {
  if (q.reason === "jit" && q.contextLabel) return `One thing for ${inSentence(q.contextLabel)}.`
  if (first) return `${withName("Hi", name)}. A quick one.`
  return null
}

/** How the user's answer reads as their reply. */
export function replyText(q: Question, value: string | string[]) {
  const values = Array.isArray(value) ? value : [value]
  const label = (v: string) => q.options?.find((o) => o.value === v)?.label ?? v
  return values.map(label).join(", ")
}

/**
 * Something's acknowledgement after an answer. `n` varies the wording; `short` drops the area
 * when a check-in follows, since the check-in names all of them.
 */
export function ackText(q: Question, n: number, { short = false } = {}) {
  const area = helpedArea(q)
  const word = ["Got it", "Thanks", "Noted"][n % 3]
  return area && !short ? `${word}, that helps with ${inSentence(area)}.` : `${word}.`
}

export const skipAck = (mode: "later" | "never") =>
  mode === "never" ? "Okay, I won't ask that again." : "No problem, I'll ask another time."

export const skipReply = (mode: "later" | "never") => (mode === "never" ? "Don't ask this again" : "Skip for now")

/** The warm pause every few answers (or after a run of skips). */
export function checkinLines(kind: "answers" | "skips", { name, areas, answered }: { name?: string | null; areas: string[]; answered: number }) {
  if (kind === "skips") {
    return ["Not feeling these right now? That's completely fine.", "Want a break, or to see why I ask?"]
  }
  return [
    `${withName("You're doing great", name)}.`,
    areas.length
      ? `That helps with ${andList(areas.map(inSentence))}.`
      : `${answered} answers so far, each one a form you won't have to fill in.`,
    "Don't you need a rest, or a hand with anything?",
  ]
}

export function helpLines(role: "founder" | "investor") {
  return [
    "I ask so you never have to fill in a long form.",
    `Your answers only go on your profile and help match you with the right ${role === "founder" ? "investors and co-founders" : "founders"}. You can change any of them there.`,
  ]
}

export const restingLines = (name?: string | null) => [
  `${withName("Rest well", name)}.`,
  "I won't ask anything until tomorrow. Everything you answered is saved.",
]

export const doneLines = ["That's everything I have for now. Thank you!", "You can change any answer on your profile."]

export const idleLines = (name: string | null | undefined, talkedBefore: boolean) =>
  talkedBefore
    ? ["Nothing else to ask right now."]
    : [`${withName("Hi", name)}. I fill in your profile one quick question at a time, so you never face a long form.`]
