"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { questionsApi, type AnswerValue, type NextResponse, type Progress, type Question, type SkipMode } from "@/lib/questions"
import { useAuth } from "@/components/auth-provider"
import { toast } from "@/components/ui/use-toast"
import {
  ackText, checkinLines, doneLines, helpedArea, helpLines, idleLines, leadIn, replyText, restingLines, skipAck, skipReply,
} from "./copy"

type Status = "idle" | "loading" | "saving"

/**
 * Where the conversation is:
 *  question: asking (or loading the next one)
 *  checkin:  every 3 answers (or 3 skips in a row), a warm pause: keep going, rest, or get help
 *  help:     why we ask, and how far along the user is
 *  resting:  the user took a break; nothing unprompted until tomorrow
 *  done:     nothing left to ask
 */
export type Phase = "question" | "checkin" | "help" | "resting" | "done"

export const CHECKIN_EVERY = 3

/** One line of the conversation so far. */
export type Msg = { id: number; from: "something" | "you"; text: string; skipped?: boolean }

const HISTORY_MAX = 60

type BoxState = {
  role: "founder" | "investor"
  question: Question | null
  empty: NextResponse | null
  open: boolean
  status: Status
  phase: Phase
  /** What was said before the live part, oldest first. */
  history: Msg[]
  /** The reply being saved, shown as the user's bubble until the server answers. */
  pending: string | null
  /** What Something says right now when no question is on screen (check-in, help, resting…). */
  lines: string[]
  /** A line before the live question (why now, or hello). */
  lead: string | null
  /** Answers in this session, and the areas the latest run of answers helped with. */
  session: { answered: number; areas: string[] }
  progress: Progress | null
  /** Goes up by one per saved answer; the creature pops when it changes. */
  savedCount: number
}

/** What the box can be asked to do. The functions never change, so pages that only ask (a
 *  just-in-time question) don't re-render whenever the conversation moves. */
type BoxActions = {
  setOpen: (open: boolean) => void
  answer: (value: AnswerValue) => Promise<void>
  skip: (mode: Extract<SkipMode, "later" | "never">) => Promise<void>
  /** Quick replies. Each one becomes the user's line in the conversation. */
  keepGoing: () => Promise<void>
  takeBreak: () => Promise<void>
  showHelp: () => void
  askMore: () => Promise<void>
  requestJIT: (context: string, open?: boolean) => Promise<void>
}

const StateCtx = createContext<BoxState | null>(null)
const ActionsCtx = createContext<BoxActions | null>(null)

export function useSomethingBox(): BoxState & BoxActions {
  const state = useContext(StateCtx)
  const actions = useContext(ActionsCtx)
  if (!state || !actions) throw new Error("useSomethingBox must be used inside SomethingBoxProvider")
  return { ...state, ...actions }
}

/** Only the actions: for callers that don't show the box's state. */
export function useSomethingBoxActions(): BoxActions {
  const actions = useContext(ActionsCtx)
  if (!actions) throw new Error("useSomethingBoxActions must be used inside SomethingBoxProvider")
  return actions
}

/**
 * Asks for the question a page needs. Asked on page load, it only makes the creature hold up
 * its diamond (the panel would cover the page's own input on a phone); pass `open: true` only
 * when the question answers something the user just did. Fires once per mount; the server caps
 * how many of these a user sees per day.
 */
export function useJustInTimeQuestion(context: string, { enabled = true, open = false }: { enabled?: boolean; open?: boolean } = {}) {
  const box = useContext(ActionsCtx)
  const fired = useRef(false)
  useEffect(() => {
    if (!box || !enabled || fired.current) return
    fired.current = true
    box.requestJIT(context, open)
  }, [box, context, enabled, open])
}

const REFRESH_AFTER_MS = 60 * 60 * 1000

/**
 * The floating Something box, as a short conversation. A waiting daily question only makes the
 * creature hold up its diamond (and peek its first words on laptops); the panel opens on its own
 * only right after the user did something that needs an answer (posting a public idea). Once
 * open, it keeps asking until the user stops: each answer is acknowledged and the next question
 * follows, and every few answers it checks in warmly (keep going, take a break, or help).
 */
export function SomethingBoxProvider({ role, children }: { role: "founder" | "investor"; children: React.ReactNode }) {
  const { user } = useAuth()
  const name = user?.name
  const [question, setQuestionState] = useState<Question | null>(null)
  const [empty, setEmpty] = useState<NextResponse | null>(null)
  const [open, setOpenState] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const [phase, setPhase] = useState<Phase>("question")
  const [checkinKind, setCheckinKind] = useState<"answers" | "skips">("answers")
  const [session, setSession] = useState({ answered: 0, areas: [] as string[] })
  const [progress, setProgress] = useState<Progress | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [history, setHistory] = useState<Msg[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const skipsInRow = useRef(0)
  const lastFetch = useRef(0)
  // A page asked for its own question; and whether the daily one has been asked for yet.
  const jitAsked = useRef(false)
  const dailyAsked = useRef(false)
  const nextId = useRef(1)
  // Mirrors `question` so a late response can see what is on screen now, not at request time.
  const current = useRef<Question | null>(null)
  const setQuestion = useCallback((q: Question | null) => {
    current.current = q
    setQuestionState(q)
  }, [])

  const say = useCallback((msgs: Omit<Msg, "id">[]) => {
    setHistory((h) => [...h, ...msgs.map((m) => ({ ...m, id: nextId.current++ }))].slice(-HISTORY_MAX))
  }, [])

  /** Resolves true when it put a question on screen. */
  const load = useCallback(async (context?: string, openIfFound = false): Promise<boolean> => {
    setStatus("loading")
    try {
      const res = await questionsApi.next(context)
      lastFetch.current = Date.now()
      // A daily load (on focus, or after a page's own question) must never replace (or clear) a
      // question a page or the user asked for.
      if (!context && current.current && current.current.reason !== "daily") return false
      if (res.question) {
        setQuestion(res.question)
        setEmpty(null)
        setPhase("question")
        if (openIfFound) setOpenState(true)
        return true
      } else if (!context || context === "more") {
        setQuestion(null)
        setEmpty(res)
        if (context === "more" && res.reason === "nothing_left") setPhase("done")
      }
    } catch {
      // The box is optional: a failed fetch just means no question right now.
    } finally {
      setStatus("idle")
    }
    return false
  }, [setQuestion])

  const loadDaily = useCallback(() => {
    dailyAsked.current = true
    return load()
  }, [load])

  useEffect(() => {
    // A tick later, so a page asking for its own question on mount goes first: the daily one then
    // waits for that answer (requestJIT) instead of racing it with a second request.
    const t = setTimeout(() => {
      if (!jitAsked.current) loadDaily()
    }, 0)
    const onFocus = () => {
      if (Date.now() - lastFetch.current > REFRESH_AFTER_MS) load()
    }
    window.addEventListener("focus", onFocus)
    return () => {
      clearTimeout(t)
      window.removeEventListener("focus", onFocus)
    }
  }, [load, loadDaily])

  const next = useCallback(() => load("more"), [load])

  // Opening the box with nothing on screen starts a session (unless the user is resting).
  const setOpen = useCallback((o: boolean) => {
    setOpenState(o)
    if (o && !current.current && phase === "question") next()
  }, [next, phase])

  const checkIn = useCallback((kind: "answers" | "skips") => {
    setCheckinKind(kind)
    setPhase("checkin")
    setQuestion(null)
    questionsApi.progress().then(setProgress).catch(() => setProgress(null))
  }, [setQuestion])

  const requestJIT = useCallback(async (context: string, open = true) => {
    jitAsked.current = true
    const found = await load(context, open)
    // Nothing for this page: the daily question it held back can come now.
    if (!found && !dailyAsked.current) await loadDaily()
  }, [load, loadDaily])

  const lead = question ? leadIn(question, { first: history.length === 0, name }) : null

  // What Something is saying in the live part, when it isn't asking.
  const talked = history.length > 0
  const lines = useMemo(
    () =>
      phase === "checkin" ? checkinLines(checkinKind, { name, areas: session.areas, answered: session.answered })
      : phase === "help" ? helpLines(role)
      : phase === "resting" ? restingLines(name)
      : phase === "done" ? doneLines
      : idleLines(name, talked),
    [phase, checkinKind, name, session.areas, session.answered, role, talked],
  )

  /** The live lines move into the history, followed by the user's quick reply. */
  const reply = useCallback((choice: string) => {
    say([...lines.map((text) => ({ from: "something" as const, text })), { from: "you", text: choice }])
  }, [lines, say])

  /** The question on screen moves into the history with the user's reply and Something's answer. */
  const settle = useCallback((q: Question, you: Omit<Msg, "id" | "from">, ack: string) => {
    say([
      ...(lead ? [{ from: "something" as const, text: lead }] : []),
      { from: "something", text: q.prompt },
      { from: "you", ...you },
      { from: "something", text: ack },
    ])
  }, [lead, say])

  const answer = useCallback(async (value: AnswerValue) => {
    const q = question
    if (!q) return
    const text = replyText(q, value)
    setPending(text)
    setStatus("saving")
    try {
      const res = await questionsApi.answer(q, value)
      window.dispatchEvent(new CustomEvent("profile:updated", { detail: res.saved }))
      const answered = session.answered + 1
      const checkinNext = answered % CHECKIN_EVERY === 0
      settle(q, { text }, ackText(q, savedCount, { short: checkinNext }))
      setPending(null)
      setQuestion(null)
      setSavedCount((n) => n + 1)
      skipsInRow.current = 0
      const area = helpedArea(q)
      const areas = area && !session.areas.includes(area) ? [...session.areas, area] : session.areas
      setSession({ answered, areas })
      setStatus("idle")
      if (checkinNext) checkIn("answers")
      else await next()
    } catch (err) {
      setPending(null)
      setStatus("idle")
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast({ title: "Not saved", description: message || "Please try again.", variant: "destructive" })
    }
  }, [question, savedCount, session, settle, setQuestion, checkIn, next])

  const skip = useCallback(async (mode: "later" | "never") => {
    const q = question
    if (!q) return
    settle(q, { text: skipReply(mode), skipped: true }, skipAck(mode))
    setQuestion(null)
    try {
      await questionsApi.skip(q, mode)
    } catch {
      // Skipping is best-effort; move on either way.
    }
    skipsInRow.current += 1
    if (skipsInRow.current >= CHECKIN_EVERY) {
      skipsInRow.current = 0
      checkIn("skips")
    } else {
      await next()
    }
  }, [question, settle, setQuestion, checkIn, next])

  const keepGoing = useCallback(async () => {
    reply("Keep going")
    setSession((s) => ({ ...s, areas: [] }))
    setPhase("question")
    await next()
  }, [reply, next])

  const takeBreak = useCallback(async () => {
    reply("Take a break")
    setQuestion(null)
    setEmpty({ question: null, reason: "paused" })
    setPhase("resting")
    try {
      await questionsApi.rest()
    } catch {
      // Resting is local too: the box stops asking for this session either way.
    }
  }, [reply, setQuestion])

  const showHelp = useCallback(() => {
    reply("Help")
    setPhase("help")
    questionsApi.progress().then(setProgress).catch(() => {})
  }, [reply])

  const askMore = useCallback(async () => {
    reply(phase === "resting" ? "Ask me one anyway" : "Ask me one")
    setPhase("question")
    await next()
  }, [reply, phase, next])

  const state = useMemo<BoxState>(
    () => ({ role, question, empty, open, status, phase, history, pending, lines, lead, session, progress, savedCount }),
    [role, question, empty, open, status, phase, history, pending, lines, lead, session, progress, savedCount],
  )

  // Stable wrappers around this render's actions (they close over the current conversation).
  const latest = useRef<BoxActions>(null!)
  latest.current = { setOpen, answer, skip, keepGoing, takeBreak, showHelp, askMore, requestJIT }
  const actions = useMemo<BoxActions>(() => ({
    setOpen: (o) => latest.current.setOpen(o),
    answer: (v) => latest.current.answer(v),
    skip: (mode) => latest.current.skip(mode),
    keepGoing: () => latest.current.keepGoing(),
    takeBreak: () => latest.current.takeBreak(),
    showHelp: () => latest.current.showHelp(),
    askMore: () => latest.current.askMore(),
    requestJIT: (context, open) => latest.current.requestJIT(context, open),
  }), [])

  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  )
}
