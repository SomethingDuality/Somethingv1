"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUp, X } from "lucide-react"
import apiClient from "@/lib/axios"
import { cached, cachedGet } from "@/lib/api-cache"
import { useJustInTimeQuestion } from "@/components/something-box/provider"
import { Creature } from "@/components/creature/creature"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IdeaCover } from "@/components/visual/idea-cover"
import { SectorList } from "@/components/visual/idea-card"
import { markTriedSomething } from "@/lib/first-run"
import {
  applyEvent, chatApi, followReview, initialView, reviewsApi, seqOf,
  type Progress, type Quota, type Reaction, type ReviewStatus, type ReviewView,
} from "@/lib/agent-transport"
import { NothingReply, ReviewProgress, SomethingReply } from "@/components/something/review-replies"
import { labelFor } from "@/lib/taxonomy"
import { apiError, cn } from "@/lib/utils"

/* ------------------------------------------------------------------------------------------------
 * Something and Nothing, as one composer (Somay picked the calm, Kimi-like layout).
 * Empty: the creature, one line about the two readers, and a single input in the middle of the
 * page. After a question it becomes a conversation: your idea, then Something and Nothing (each in
 * its own colour, saying what they'll tell you once the AI review ships, F8), then the two checks
 * that work today on real data: Overlaps and Readiness.
 * ---------------------------------------------------------------------------------------------- */

type SavedIdea = {
  _id: string
  title: string
  description: string
  tags?: string[]
  stage?: string
  raising?: string
  lookingFor?: string[]
  attachments?: unknown[]
  milestones?: unknown[]
}
type Match = { id: string; title: string; author?: string; stage: string; tags: string[]; sharedWords: string[]; sharedSectors: string[] }
type Overlaps = { compared: number; matches: Match[] }
type Turn = {
  id: number
  text: string
  idea: SavedIdea | null
  readers: Reader[]
  overlaps: Overlaps | null
  error: string | null
  /** The real review, when the agent is live. */
  review: ReviewView | null
  progress: Progress
  /** Something's answer when the message wasn't an idea ("hi"). */
  general: string | null
  reviewError: string | null
  /** The newest event id we have (`seqs`) may be behind the agent's (brought back after a reload, or polled). */
  seqBehind?: boolean
  reacting: boolean
  /** Brought back after a reload: the checks below weren't run for it. */
  restored?: boolean
  /** A message to Something about the review above it (no new review, no checks). */
  chat?: { reply: string | null; error?: string | null }
}
type Reader = "something" | "nothing"

const READERS: Record<Reader, {
  name: string
  side: string
  holding: boolean
  color: string
  soft: string
  dot: string
  questions: string[]
  example: [string, string][]
}> = {
  something: {
    name: "Something",
    side: "why it could work",
    holding: true,
    color: "text-gold",
    soft: "bg-gold-soft",
    dot: "bg-gold",
    questions: ["Who wants this most, and how badly", "What would make them come back", "The strongest proof you could show next"],
    example: [
      ["Who wants it most", "Students whose hostel mess closes at 9 pm and who order three or more nights a week."],
      ["Why they'd come back", "One fixed 11 pm drop at the hostel gate, cheaper than app delivery fees."],
      ["Strongest next proof", "Fifty pre-orders from a single hostel in one week."],
    ],
  },
  nothing: {
    name: "Nothing",
    side: "what could sink it",
    holding: false,
    color: "text-[#8fb8ff]",
    soft: "bg-[#8fb8ff]/10",
    dot: "bg-[#8fb8ff]",
    questions: ["The riskiest thing you're assuming", "Who already does this, and why people stay with them", "The cheapest way to find out you're wrong"],
    example: [
      ["Riskiest assumption", "That wardens let a vendor wait at the gate after 10 pm."],
      ["Who already does it", "Food apps, and the canteen cook who already takes orders on WhatsApp."],
      ["Cheapest test", "Ask two wardens this week, before cooking anything."],
    ],
  },
}
const EXAMPLE_IDEA = "Late-night meals for college hostels"
const GONE = { code: "not_found", message: "This review isn't available any more.", retryable: false }

const sameProgress = (a: Progress, b: Progress) => a === b || (a !== null && b !== null && a.stage === b.stage && a.text === b.text)

// Whether the review agent answered "live" earlier in this tab. If so the latest review is asked
// for alongside the status; otherwise only after it (a review agent that is down answers 503).
let agentWasLive = false

export default function SomethingPage() {
  useJustInTimeQuestion("ai_review")
  // The founder's ideas and profile paint from what this tab already has (lib/api-cache).
  const [ideas, setIdeas] = useState<SavedIdea[]>(() => cached<SavedIdea[]>("/ideas/user") ?? [])
  const [profileDone, setProfileDone] = useState(() => cached<{ profileCompletion?: number }>("/founder/profile")?.profileCompletion ?? 0)
  const [waitlist, setWaitlist] = useState<boolean | null>(null)

  const [picked, setPicked] = useState<SavedIdea | null>(null)
  const [readers, setReaders] = useState<Reader[]>(["something", "nothing"])
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState<ReviewStatus | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const follows = useRef(new Map<number, AbortController>())
  // The newest stream event id applied, per turn. Not state: most events (progress) change
  // nothing on screen, and a new id alone shouldn't re-render the page.
  const seqs = useRef(new Map<number, number>())
  // False once the page is gone: a review started or reacted to just before leaving opens no stream.
  const alive = useRef(true)

  // Updates one turn; a patch that changes nothing leaves the list (and the page) as it was.
  const patch = useCallback((id: number, f: (t: Turn) => Partial<Turn>) => {
    setTurns((all) => {
      let changed = false
      const next = all.map((t) => {
        if (t.id !== id) return t
        const p = f(t)
        if ((Object.keys(p) as (keyof Turn)[]).every((k) => Object.is(p[k], t[k]))) return t
        changed = true
        return { ...t, ...p }
      })
      return changed ? next : all
    })
  }, [])

  const noteSeq = useCallback((turnId: number, seq: number) => {
    seqs.current.set(turnId, Math.max(seqs.current.get(turnId) ?? 0, seq))
  }, [])

  // Follow a review's stream from `after` until it pauses for the founder (a pause newer than
  // `known`, see endsFollow), finishes or fails.
  const follow = useCallback((turnId: number, reviewId: string, after: number, known = after) => {
    if (!alive.current) return
    follows.current.get(turnId)?.abort()
    const ctrl = new AbortController()
    follows.current.set(turnId, ctrl)
    followReview(reviewId, {
      after,
      known,
      signal: ctrl.signal,
      onEvent: (ev) => {
        const seq = seqOf(ev)
        if (seq !== null) noteSeq(turnId, seq)
        patch(turnId, (t) => {
          if (!t.review) return {}
          const out = applyEvent(t.review, ev)
          return {
            review: out.view,
            // The same line again (the agent repeats it) is no change.
            ...(out.progress !== undefined && !sameProgress(out.progress, t.progress) && { progress: out.progress }),
            // A follow that goes on through pauses doesn't end at them, so the pause ends the wait.
            ...(out.ended && { reacting: false }),
          }
        })
      },
      // A polled view carries the newest event id when it was read (older agents didn't).
      onPoll: (view) => {
        if (view.lastEventId !== undefined) noteSeq(turnId, view.lastEventId)
        patch(turnId, () => ({ review: view, progress: null, seqBehind: view.lastEventId === undefined }))
      },
      onGone: () => patch(turnId, (t) => ({ review: t.review && { ...t.review, status: "failed", error: GONE }, progress: null })),
    }).finally(() => {
      if (follows.current.get(turnId) !== ctrl) return // a newer follow took over, or the page closed
      follows.current.delete(turnId)
      patch(turnId, () => ({ reacting: false }))
    })
  }, [patch, noteSeq])

  useEffect(() => {
    let active = true // this run of the effect (strict mode runs it twice)
    alive.current = true
    cachedGet<SavedIdea[]>("/ideas/user", setIdeas).catch(() => setIdeas([]))
    cachedGet<{ profileCompletion?: number }>("/founder/profile", (p) => setProfileDone(p.profileCompletion ?? 0)).catch(() => {})
    const early = agentWasLive ? reviewsApi.latest() : null
    early?.catch(() => {}) // used below once the status is in
    reviewsApi.status().then((st) => {
      if (!active) return
      setLive(st)
      agentWasLive = st.live
      if (st.live && "quota" in st && st.quota) setQuota(st.quota)
      if (!st.live) {
        // "Tell me when it's live" only shows while it isn't.
        apiClient.get<{ joined: boolean }>("/founder/review-waitlist").then((r) => setWaitlist(r.data.joined)).catch(() => setWaitlist(null))
        return
      }
      // A review still running or waiting for reactions comes back after a reload.
      ;(early ?? reviewsApi.latest()).then((v) => {
        if (!active || !v || (v.status !== "running" && v.status !== "awaiting_reaction")) return
        const id = Date.now()
        const known = v.lastEventId
        seqs.current.set(id, known ?? 0)
        setTurns([{ id, text: v.brief?.oneLiner ?? "Your last review", idea: null, readers: v.readers, overlaps: null, error: null,
          review: v, progress: v.status === "running" ? { stage: "reading", text: "Picking up where it left off." } : null,
          general: null, reviewError: null, seqBehind: known === undefined, reacting: false, restored: true }])
        // The view carries the newest event id: a running review resumes after it, and one that
        // waits for the founder is followed again when they react. Without an id (an older agent),
        // replay from the start through the old pauses.
        if (known === undefined) follow(id, v.reviewId, 0, Infinity)
        else if (v.status === "running") follow(id, v.reviewId, known, known)
        chatApi.history(v.reviewId).then((msgs) => {
          if (!active) return
          const pairs: Turn[] = []
          for (let i = 0; i + 1 < msgs.length; i += 2) {
            if (msgs[i].role !== "founder" || msgs[i + 1].role !== "something") continue
            pairs.push({ id: id + i + 1, text: msgs[i].text, idea: null, readers: [], overlaps: null, error: null, review: null, progress: null,
              general: null, reviewError: null, reacting: false, chat: { reply: msgs[i + 1].text } })
          }
          if (pairs.length) setTurns((all) => [...all, ...pairs])
        }).catch(() => {})
      }).catch(() => {})
    })
    const all = follows.current
    return () => {
      active = false
      alive.current = false
      all.forEach((c) => c.abort())
      all.clear()
    }
  }, [follow])

  // Follow the conversation to its end when a turn is added, or as a reply grows while the
  // founder is already at the end. Reading further up, they stay where they are.
  const nearEnd = useRef(true)
  const shownTurns = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      nearEnd.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  useEffect(() => {
    const added = turns.length > shownTurns.current
    shownTurns.current = turns.length
    if (turns.length && (added || nearEnd.current)) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns])

  // The newest review on screen: typed text after it goes to Something's chat first.
  const lastReview = [...turns].reverse().find((t) => t.review && t.review.status !== "failed")?.review ?? null

  const send = async (typed: string) => {
    if (busy || (!picked && !typed)) return
    const id = Date.now()
    const base: Turn = { id, text: picked ? picked.title : typed, idea: picked, readers, overlaps: null, error: null,
      review: null, progress: null, general: null, reviewError: null, reacting: false }
    markTriedSomething()
    setPicked(null)
    if (live?.live && lastReview && !picked) {
      setTurns((t) => [...t, { ...base, chat: { reply: null } }])
      setBusy(true)
      try {
        const res = await chatApi.turn({ text: typed, reviewId: lastReview.reviewId, ...(lastReview.ideaId ? { ideaId: lastReview.ideaId } : {}) })
        if (res.kind !== "new_idea") {
          patch(id, () => ({ chat: { reply: res.reply } }))
          setBusy(false)
          return
        }
        patch(id, () => ({ chat: undefined }))  // a new pitch: it becomes a review below
      } catch (err) {
        patch(id, () => ({ chat: { reply: null, error: apiError(err, "Something couldn't reply just now. Please try again.") } }))
        setBusy(false)
        return
      }
    } else {
      setTurns((t) => [...t, base])
      setBusy(true)
    }
    const body = picked ? { ideaId: picked._id } : { text: typed }
    const review = live?.live ? startReview(id, body, readers, picked?._id ?? null) : Promise.resolve()
    try {
      const res = await apiClient.post<Overlaps>("/founder/overlaps", body)
      patch(id, () => ({ overlaps: res.data }))
    } catch (err) {
      patch(id, () => ({ error: apiError(err, "Couldn't check right now.") }))
    } finally {
      await review
      setBusy(false)
    }
  }

  const startReview = async (id: number, body: { ideaId?: string; text?: string }, rs: Reader[], ideaId: string | null) => {
    patch(id, () => ({ progress: { stage: "reading", text: "Starting." } }))
    try {
      const res = await reviewsApi.start({ ...body, readers: rs })
      if (res.kind === "general") {
        patch(id, () => ({ general: res.reply, progress: null }))
        return
      }
      setQuota(res.quota)
      patch(id, () => ({ review: initialView(res.reviewId, rs, ideaId ? "saved_idea" : "typed_text", ideaId) }))
      follow(id, res.reviewId, 0)
    } catch (err) {
      patch(id, () => ({ reviewError: apiError(err, "The review couldn't start. Please try again."), progress: null }))
    }
  }

  const react = async (turn: Turn, reaction: Reaction) => {
    if (!turn.review) return
    patch(turn.id, () => ({ reacting: true, progress: reaction.kind === "dispute" ? { stage: "rebuttal", text: "Reading your reply." } : null }))
    try {
      await reviewsApi.react(turn.review.reviewId, reaction)
      // A follow still open (a review brought back after a reload) carries the reply by itself.
      // Otherwise resume after the newest event applied, through replayed pauses if that may be behind.
      const last = seqs.current.get(turn.id) ?? 0
      if (!follows.current.has(turn.id)) follow(turn.id, turn.review.reviewId, last, turn.seqBehind ? Infinity : last)
    } catch (err) {
      patch(turn.id, () => ({ reacting: false, progress: null, reviewError: apiError(err, "That didn't save. Please try again.") }))
    }
  }

  const toggleWaitlist = async () => {
    const join = !waitlist
    setWaitlist(join)
    try {
      await (join ? apiClient.post("/founder/review-waitlist", {}) : apiClient.delete("/founder/review-waitlist"))
    } catch {
      setWaitlist(!join)
    }
  }

  const composer = (
    <Composer
      picked={picked}
      setPicked={setPicked}
      ideas={ideas}
      readers={readers}
      setReaders={setReaders}
      onSend={send}
      busy={busy}
      compact={turns.length > 0}
      placeholder={live?.live && lastReview ? "Ask Something about this, or describe a new idea" : undefined}
    />
  )

  // Empty: everything sits in the middle of the page.
  if (turns.length === 0) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-[720px] flex-col justify-center py-10">
        <div className="flex flex-col items-center text-center">
          <Creature size={64} holding className="text-foreground" />
          <h1 className="mt-6 text-[34px] leading-tight sm:text-[40px]">Something and Nothing</h1>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
            Two readers for your idea. Something looks for why it could work; Nothing looks for what could sink it.
          </p>
        </div>
        <div className="mt-10">{composer}</div>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          {live?.live ? <QuotaLine quota={quota} /> : <>Their AI reviews aren&apos;t live yet. Overlaps and Readiness work today.{" "}</>}
          We never use your ideas to build anything of ours, and we delete them when you ask.
        </p>
        {live?.fakeModels && <FakeModelsNote />}
      </div>
    )
  }

  // A conversation: turns on top, the composer pinned at the bottom.
  return (
    <div className="mx-auto w-full max-w-[760px] pb-48">
      <ol className="space-y-16">
        {turns.map((turn, index) => {
          // A review restored after a reload knows only its idea id: show that idea's name.
          const idea = turn.idea ?? ideas.find((i) => i._id === turn.review?.ideaId) ?? null
          return (
          <li key={turn.id} className="space-y-6">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-surface-2 px-5 py-3.5">
                {idea && (
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <IdeaCover id={idea._id} sectors={idea.tags} className="size-4" rounded="rounded-full" />
                    Your saved idea
                  </div>
                )}
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{idea && !turn.idea ? idea.title : turn.text}</p>
              </div>
            </div>

            {turn.chat ? (
              <ChatReply turn={turn} />
            ) : live?.live
              ? <LiveReaders turn={turn} onReact={(r) => react(turn, r)} />
              : turn.readers.map((r) => (
                <ReaderReply key={r} reader={r} brief={index > 0} waitlist={waitlist} onWaitlist={toggleWaitlist} />
              ))}

            {!turn.chat && <ChecksReply turn={turn} profileDone={profileDone} live={Boolean(live?.live)} />}
          </li>
          )
        })}
      </ol>
      <div ref={endRef} />

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background from-60% to-transparent pb-6 pt-10 md:pl-56">
        <div className="mx-auto w-full max-w-[760px] px-5 md:px-12 lg:px-0">
          {composer}
          {live?.live && quota && <p className="mt-2 text-center text-xs text-muted-foreground"><QuotaLine quota={quota} /></p>}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------ */

/** The input, with its own text: typing re-renders only this, not the conversation above. */
function Composer({
  picked,
  setPicked,
  ideas,
  readers,
  setReaders,
  onSend,
  busy,
  compact,
  placeholder,
}: {
  picked: SavedIdea | null
  setPicked: (v: SavedIdea | null) => void
  ideas: SavedIdea[]
  readers: Reader[]
  setReaders: (v: Reader[]) => void
  onSend: (text: string) => void
  busy: boolean
  compact: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState("")
  const canSend = !busy && (Boolean(picked) || text.trim().length > 0)
  const send = () => {
    if (!canSend) return
    onSend(text.trim())
    setText("")
  }

  // Grow with the text, up to a limit.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [text])

  // At least one reader stays on: a review with neither is refused.
  const toggleReader = (r: Reader) => {
    if (!readers.includes(r)) setReaders([...readers, r])
    else if (readers.length > 1) setReaders(readers.filter((x) => x !== r))
  }

  return (
    <div>
      <div className="rounded-[28px] border border-line bg-surface px-5 pb-3 pt-4 transition-colors focus-within:border-muted-foreground/60">
        {picked ? (
          <div className="flex items-center gap-3 py-1.5">
            <IdeaCover id={picked._id} sectors={picked.tags} className="size-9 shrink-0" rounded="rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base">{picked.title}</p>
              <p className="text-xs text-muted-foreground">Your saved idea</p>
            </div>
            <button type="button" onClick={() => setPicked(null)} aria-label="Remove" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
            }}
            rows={compact ? 1 : 3}
            maxLength={2000}
            aria-label="Your idea"
            placeholder={placeholder ?? "What are you building?"}
            className="block w-full resize-none bg-transparent text-[17px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          {ideas.length > 0 && !picked ? (
            <Popover>
              <PopoverTrigger className="rounded-full border border-line px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
                Use one of my ideas
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 rounded-2xl border-line bg-popover p-1.5">
                {ideas.map((i) => (
                  <button
                    key={i._id}
                    type="button"
                    onClick={() => setPicked(i)}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2 cursor-pointer"
                  >
                    <IdeaCover id={i._id} sectors={i.tags} className="size-8 shrink-0" rounded="rounded-md" />
                    <span className="truncate text-sm">{i.title}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          ) : <span />}
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label={busy ? "Checking" : "Ask"}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Who reads it">
        {(Object.keys(READERS) as Reader[]).map((r) => {
          const on = readers.includes(r)
          const meta = READERS[r]
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => toggleReader(r)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
                on ? cn("border-transparent", meta.soft, meta.color) : "border-line text-muted-foreground hover:text-foreground",
              )}
            >
              <Creature size={16} holding={meta.holding} />
              {meta.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------ */

function Speaker({ children, icon, name, color }: { children: React.ReactNode; icon: React.ReactNode; name: string; color?: string }) {
  return (
    <div className="flex gap-4">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", color ?? "text-foreground")}>{name}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  )
}

function ReaderReply({ reader, brief, waitlist, onWaitlist }: { reader: Reader; brief: boolean; waitlist: boolean | null; onWaitlist: () => void }) {
  const meta = READERS[reader]
  const [example, setExample] = useState(false)
  // After the first question, a reader that can't answer yet says so in one line.
  if (brief) {
    return (
      <Speaker
        name={meta.name}
        color={meta.color}
        icon={
          <span className={cn("grid size-9 place-items-center rounded-full", meta.soft)}>
            <Creature size={20} holding={meta.holding} className={meta.color} />
          </span>
        }
      >
        <p className="text-[15px] leading-relaxed text-muted-foreground">I&apos;ll read this one too once my AI review is live.</p>
      </Speaker>
    )
  }
  return (
    <Speaker
      name={meta.name}
      color={meta.color}
      icon={
        <span className={cn("grid size-9 place-items-center rounded-full", meta.soft)}>
          <Creature size={20} holding={meta.holding} className={meta.color} />
        </span>
      }
    >
      <p className="text-[15px] leading-relaxed">
        I can&apos;t read it yet: my AI review isn&apos;t live. When it is, I&apos;ll tell you {meta.side}:
      </p>
      <ul className="mt-3 space-y-1.5">
        {meta.questions.map((q) => (
          <li key={q} className="flex gap-3 text-[15px] leading-relaxed text-foreground/90">
            <span className={cn("mt-[9px] size-1.5 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
            {q}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <button type="button" onClick={() => setExample((v) => !v)} aria-expanded={example} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-pointer">
          {example ? "Hide the example" : "See an example"}
        </button>
        {waitlist !== null && (
          <button type="button" onClick={onWaitlist} className={cn("underline-offset-4 hover:underline cursor-pointer", waitlist ? "text-muted-foreground" : meta.color)}>
            {waitlist ? "You're on the list" : "Tell me when it's live"}
          </button>
        )}
      </div>
      {example && (
        <div className="mt-4 rounded-2xl border border-line p-5">
          <p className="text-xs text-muted-foreground">Example, on a made-up idea: &ldquo;{EXAMPLE_IDEA}&rdquo;</p>
          <dl className="mt-3 space-y-3">
            {meta.example.map(([k, v]) => (
              <div key={k}>
                <dt className={cn("text-sm", meta.color)}>{k}</dt>
                <dd className="mt-0.5 text-[15px] leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Speaker>
  )
}

function ChecksReply({ turn, profileDone, live }: { turn: Turn; profileDone: number; live: boolean }) {
  return (
    <Speaker
      name={live ? "Other checks" : "Checks that work today"}
      color="text-muted-foreground"
      icon={<span className="grid size-9 place-items-center rounded-full bg-surface-2 text-xs text-muted-foreground">✓</span>}
    >
      {turn.error ? (
        <p role="alert" className="text-[15px] text-destructive">{turn.error}</p>
      ) : turn.restored && !turn.overlaps ? (
        <p className="text-[15px] text-muted-foreground">Ask again to compare it with the ideas on Something.</p>
      ) : !turn.overlaps ? (
        <p className="text-[15px] text-muted-foreground">Comparing with the ideas on Something…</p>
      ) : (
        <div className="space-y-8">
          <OverlapsBlock overlaps={turn.overlaps} />
          {turn.idea ? (
            <ReadinessBlock idea={turn.idea} profileDone={profileDone} />
          ) : (
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Readiness needs a saved idea.{" "}
              <Link href="/founder/ideas?new=true" className="text-foreground underline underline-offset-4">Post this one</Link>{" "}
              to see what it&apos;s missing before investors look.
            </p>
          )}
        </div>
      )}
    </Speaker>
  )
}

function OverlapsBlock({ overlaps }: { overlaps: Overlaps }) {
  return (
    <section>
      <h3 className="text-base">Overlaps</h3>
      {overlaps.matches.length === 0 ? (
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Nothing close among the {overlaps.compared} {overlaps.compared === 1 ? "idea" : "ideas"} posted on Something. That only
          covers this site.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {overlaps.matches.length} similar {overlaps.matches.length === 1 ? "idea" : "ideas"} out of {overlaps.compared} on Something
          </p>
          <ul className="mt-3 space-y-2">
            {overlaps.matches.map((m) => (
              <li key={m.id} className="flex gap-3 rounded-2xl border border-line p-3.5">
                <IdeaCover id={m.id} sectors={m.tags} className="size-11 shrink-0" rounded="rounded-xl" />
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{m.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[m.author, m.stage ? labelFor("ideaStages", m.stage) : ""].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {m.sharedSectors.length > 0 && <SectorList sectors={m.sharedSectors} />}
                    {m.sharedWords.length > 0 && <span>Both mention {m.sharedWords.slice(0, 3).join(", ")}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** What a saved idea is missing before investors look, each with where to fix it. */
function ReadinessBlock({ idea, profileDone }: { idea: SavedIdea; profileDone: number }) {
  const edit = `/founder/ideas?edit=${idea._id}`
  const checks = [
    { label: "Stage", done: Boolean(idea.stage), fix: edit },
    { label: "Sectors", done: (idea.tags ?? []).length > 0, fix: edit },
    { label: "How much you're raising", done: Boolean(idea.raising), fix: edit },
    { label: "Who you're looking for", done: (idea.lookingFor ?? []).length > 0, fix: edit },
    { label: "A pitch of at least a few lines", done: (idea.description ?? "").trim().length >= 200, fix: edit },
    { label: "A file (deck, demo or doc)", done: (idea.attachments ?? []).length > 0, fix: edit },
    { label: "At least one milestone", done: (idea.milestones ?? []).length > 0, fix: `/founder/ideas/${idea._id}` },
    { label: "Your profile filled in", done: profileDone >= 100, fix: "/founder/profile" },
  ]
  const done = checks.filter((c) => c.done).length
  const missing = checks.filter((c) => !c.done)
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-base">Readiness</h3>
        <span className={cn("text-sm", done === checks.length ? "text-done" : "text-muted-foreground")}>{done} of {checks.length} ready</span>
      </div>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {checks.map((c) => <span key={c.label} className={cn("h-1.5 flex-1 rounded-full", c.done ? "bg-done" : "bg-line")} />)}
      </div>
      {missing.length === 0 ? (
        <p className="mt-3 text-[15px] text-done">Everything investors look for first is there.</p>
      ) : (
        <>
          <p className="mt-4 text-[15px] text-muted-foreground">Still missing:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((c) => (
              <li key={c.label}>
                <Link href={c.fix} className="inline-flex rounded-full border border-line px-3.5 py-1.5 text-sm text-foreground transition-colors hover:border-gold/50 hover:text-gold">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------------------------------------ */

const readerIcon = (r: Reader) => (
  <span className={cn("grid size-9 place-items-center rounded-full", READERS[r].soft)}>
    <Creature size={20} holding={READERS[r].holding} className={READERS[r].color} />
  </span>
)

/** The real readers: Nothing's review and Something's reply, plus the one progress line. */
function LiveReaders({ turn, onReact }: { turn: Turn; onReact: (r: Reaction) => void }) {
  const v = turn.review
  if (turn.general) {
    return <Speaker name="Something" color={READERS.something.color} icon={readerIcon("something")}><p className="text-[15px] leading-relaxed">{turn.general}</p></Speaker>
  }
  if (turn.reviewError || v?.status === "failed") {
    return (
      <Speaker name="Something and Nothing" color="text-muted-foreground" icon={readerIcon("nothing")}>
        <p role="alert" className="text-[15px] leading-relaxed text-muted-foreground">
          {turn.reviewError || v?.error?.message || "The review couldn't finish. Please try again."}
        </p>
      </Speaker>
    )
  }
  const waiting = turn.progress?.text || (v?.status === "running" ? "Working on it." : "")
  return (
    <>
      {turn.readers.includes("nothing") && (
        <Speaker name="Nothing" color={READERS.nothing.color} icon={readerIcon("nothing")}>
          {v?.nothing ? <NothingReply review={v} busy={turn.reacting} onReact={onReact} /> : <ReviewProgress text={waiting || "Waiting."} />}
          {v?.nothing && turn.reacting && turn.progress && <div className="mt-3"><ReviewProgress text={turn.progress.text} /></div>}
        </Speaker>
      )}
      {turn.readers.includes("something") && (
        <Speaker name="Something" color={READERS.something.color} icon={readerIcon("something")}>
          {v?.something ? <SomethingReply review={v} /> : <ReviewProgress text={turn.readers.includes("nothing") && v?.nothing ? "Writing how to answer it." : waiting || "Waiting."} />}
        </Speaker>
      )}
    </>
  )
}

function QuotaLine({ quota }: { quota: Quota | null }) {
  if (!quota) return null
  const left = Math.max(0, quota.limit - quota.used)
  return <>{left === 0 ? "No reviews left today; they come back tomorrow." : `${left} of ${quota.limit} reviews left today.`}{" "}</>
}

function FakeModelsNote() {
  return (
    <p className="mt-2 text-center text-xs text-muted-foreground">
      Test mode: the replies are scripted placeholders until the review models are switched on.
    </p>
  )
}

/** Something's reply to a message about the review above (the Something chat). */
function ChatReply({ turn }: { turn: Turn }) {
  const c = turn.chat
  return (
    <Speaker name="Something" color={READERS.something.color} icon={readerIcon("something")}>
      {c?.error ? (
        <p role="alert" className="text-[15px] leading-relaxed text-muted-foreground">{c.error}</p>
      ) : c?.reply ? (
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{c.reply}</p>
      ) : (
        <ReviewProgress text="Writing a reply." />
      )}
    </Speaker>
  )
}
