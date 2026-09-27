"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Creature } from "@/components/creature/creature"
import { Skeleton } from "@/components/visual/skeleton"
import { pillClass } from "@/components/shell/page"
import { CHECKIN_EVERY, useSomethingBox, type Msg } from "./provider"
import { QuestionInput } from "./question-input"

const outlinePill =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full border border-line px-5 text-[15px] text-foreground transition-colors hover:border-muted-foreground cursor-pointer"

const PEEK_KEY = "something-box:peek-hidden"

const readHidden = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(PEEK_KEY) || "[]")
  } catch {
    return []
  }
}

/**
 * The orb (bottom-right) and its panel, a short conversation with Something; the panel is a
 * bottom sheet on phones. When a question is waiting, the creature holds up its diamond and, on
 * laptops, its first words peek out beside the orb.
 */
export function SomethingBox() {
  const box = useSomethingBox()
  const { question: q, open, setOpen } = box
  const orbRef = useRef<HTMLButtonElement>(null)
  const [hidden, setHidden] = useState<string[]>([])

  useEffect(() => setHidden(readHidden()), [])

  const waiting = Boolean(q) && !open
  const peekKey = q ? `${q.id}:${q.entityId ?? ""}` : ""
  const peek = waiting && !hidden.includes(peekKey)

  const hidePeek = () => {
    const next = [...hidden, peekKey].slice(-50)
    setHidden(next)
    try {
      sessionStorage.setItem(PEEK_KEY, JSON.stringify(next))
    } catch {
      // Not remembered across reloads; fine.
    }
  }

  const close = () => {
    setOpen(false)
    orbRef.current?.focus()
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
        {peek && q && (
          <div className="hidden h-11 max-w-[320px] items-center rounded-full border border-line bg-surface-2 pl-4 pr-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)] sm:flex">
            <button type="button" onClick={() => setOpen(true)} className="min-w-0 truncate text-[15px] text-foreground cursor-pointer">
              {q.prompt}
            </button>
            <button
              type="button"
              onClick={hidePeek}
              aria-label="Hide this question"
              className="ml-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <button
          ref={orbRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={waiting ? "Something has a question for you" : open ? "Close Something" : "Open Something"}
          aria-expanded={open}
          className="flex size-14 items-center justify-center rounded-full border border-line bg-surface-2 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-colors hover:border-muted-foreground cursor-pointer"
        >
          <Creature size={32} holding={waiting} />
        </button>
      </div>

      {open && <Panel onClose={close} />}
    </>
  )
}

function Panel({ onClose }: { onClose: () => void }) {
  const box = useSomethingBox()
  const panelRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const { phase, question: q, status, pending, history } = box

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      // Keep Tab inside the panel while it's open.
      if (e.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, a[href]")
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  // Follow the conversation: the newest line is always in view.
  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : "smooth" })
  }, [history.length, pending, phase, q?.id, q?.entityId, status])

  // Quick replies get the focus when they replace the answer controls.
  const dockRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase !== "question") dockRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus()
  }, [phase])

  const asking = phase === "question" || phase === "checkin"
  const round = phase === "checkin" ? CHECKIN_EVERY : box.session.answered % CHECKIN_EVERY
  const subtitle =
    phase === "resting" ? "Resting until tomorrow"
    : phase === "done" ? "All caught up"
    : "One quick question at a time"

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Something"
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden border border-line bg-background text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.75)]",
        "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[28px]",
        "sm:inset-x-auto sm:bottom-[92px] sm:right-5 sm:max-h-[min(640px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-[28px]",
        "animate-in fade-in duration-150 motion-reduce:animate-none",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line py-3.5 pl-5 pr-3">
        <div className="min-w-0">
          <p className="text-[15px] leading-tight">Something</p>
          <p className="mt-0.5 text-[13px] leading-tight text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {asking && (
            <span className="flex gap-1.5" role="img" aria-label={`${round} of ${CHECKIN_EVERY} answers before a check-in`}>
              {Array.from({ length: CHECKIN_EVERY }).map((_, i) => (
                <span key={i} className={cn("size-1.5 rounded-full transition-colors", i < round ? "bg-gold" : "bg-line")} />
              ))}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
        <Thread />
      </div>

      <Dock ref={dockRef} />
    </div>
  )
}

/* ─── The conversation ──────────────────────────────────────────────────────── */

type Item = { key: string; from: "something" | "you"; node: ReactNode; live?: boolean }

/** History plus the live part, grouped into turns: Something on the left, the user on the right. */
function Thread() {
  const box = useSomethingBox()
  const { question: q, phase, status, pending, history, lines, lead } = box

  const items: Item[] = history.map((m) => ({ key: `h${m.id}`, from: m.from, node: <Past msg={m} /> }))

  const live: Item[] = []
  if (q) {
    live.push({
      key: `q:${q.id}:${q.entityId ?? ""}`,
      from: "something",
      live: true,
      node: (
        <div className="space-y-1.5">
          {lead && <p className="text-[15px] leading-relaxed text-muted-foreground">{lead}</p>}
          <p className="text-lg leading-snug">{q.prompt}</p>
          {q.help && <p className="pt-0.5 text-[13px] leading-relaxed text-muted-foreground">{q.help}</p>}
        </div>
      ),
    })
  }
  if (pending) {
    live.push({ key: "pending", from: "you", node: <Bubble text={pending} faint /> })
    live.push({ key: "typing", from: "something", live: true, node: <Typing /> })
  } else if (!q && phase === "question" && status === "loading") {
    live.push({ key: "typing", from: "something", live: true, node: <Typing /> })
  } else if (!q) {
    live.push({
      key: `lines:${phase}`,
      from: "something",
      live: true,
      node: (
        <div className="space-y-2">
          {lines.map((l, i) => (
            <p key={i} className={cn("leading-relaxed", i === 0 ? "text-lg leading-snug" : "text-[15px] text-muted-foreground")}>{l}</p>
          ))}
          {phase === "help" && <ProgressCard />}
        </div>
      ),
    })
  }

  // Consecutive lines from the same side form one turn.
  const groups: { from: Item["from"]; items: Item[] }[] = []
  for (const it of [...items, ...live]) {
    const last = groups[groups.length - 1]
    if (last && last.from === it.from) last.items.push(it)
    else groups.push({ from: it.from, items: [it] })
  }
  const lastSomething = groups.map((g) => g.from).lastIndexOf("something")
  // The diamond stays up while a question is on screen or on its way, and pops with each save.
  const holding = phase === "question" && (Boolean(q) || Boolean(pending) || status === "loading")

  return (
    <ol className="space-y-5">
      {groups.map((g, gi) =>
        g.from === "you" ? (
          <li key={g.items[0].key} className="flex flex-col items-end gap-1.5">
            {g.items.map((it) => <div key={it.key} className="contents">{it.node}</div>)}
          </li>
        ) : (
          <li key={g.items[0].key} className="flex gap-3">
            <span className="w-6 shrink-0 pt-0.5" aria-hidden="true">
              {gi === lastSomething && g.items.some((it) => it.live) && (
                <Creature size={24} holding={holding} pop={box.savedCount} />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              {g.items.map((it) => <div key={it.key}>{it.node}</div>)}
            </div>
          </li>
        ),
      )}
    </ol>
  )
}

function Past({ msg }: { msg: Msg }) {
  if (msg.from === "you") return <Bubble text={msg.text} skipped={msg.skipped} />
  return <p className="text-[15px] leading-relaxed text-muted-foreground">{msg.text}</p>
}

function Bubble({ text, skipped, faint }: { text: string; skipped?: boolean; faint?: boolean }) {
  return (
    <p
      className={cn(
        "max-w-[85%] whitespace-pre-line break-words rounded-[20px] rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed",
        skipped ? "border border-line text-muted-foreground" : "bg-surface-2 text-foreground",
        faint && "opacity-60",
      )}
    >
      {text}
    </p>
  )
}

function Typing() {
  return (
    <span className="flex h-7 items-center gap-1" role="status" aria-label="Something is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="box-typing size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  )
}

/** Inside the help reply: how far along the user is, per area. */
function ProgressCard() {
  const { progress } = useSomethingBox()
  if (!progress || progress.total === 0) return null
  const pct = Math.round((progress.answered / progress.total) * 100)
  return (
    <div className="mt-3 rounded-[20px] border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-4 text-[13px]">
        <span>Your profile</span>
        <span className="text-muted-foreground">{progress.answered} of {progress.total} answered</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-done" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3.5 space-y-2">
        {progress.areas.slice(0, 5).map((a) => {
          const done = a.answered === a.total
          return (
            <li key={a.id} className="flex items-center justify-between gap-4 text-[13px]">
              <span className={done ? "text-muted-foreground" : "text-foreground"}>{a.label}</span>
              <span className={done ? "text-done" : "text-muted-foreground"}>{done ? "Done" : `${a.answered} of ${a.total}`}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ─── What the user can do now ──────────────────────────────────────────────── */

function Dock({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  const box = useSomethingBox()
  const { question: q, phase, status, pending, history, role } = box
  const profileHref = `/${role}/profile`

  let body: ReactNode = null
  if (q) {
    body = (
      <>
        <QuestionInput question={q} saving={status === "saving"} onSubmit={box.answer} />
        <div className="mt-3 flex items-center justify-between gap-4 text-[13px]">
          <button type="button" disabled={Boolean(pending)} onClick={() => box.skip("later")} className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer disabled:opacity-40">
            Skip for now
          </button>
          <button type="button" disabled={Boolean(pending)} onClick={() => box.skip("never")} className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer disabled:opacity-40">
            Don&apos;t ask this again
          </button>
        </div>
      </>
    )
  } else if (phase === "checkin" || phase === "help") {
    body = (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={box.keepGoing} className={pillClass}>Keep going</button>
        <button type="button" onClick={box.takeBreak} className={outlinePill}>Take a break</button>
        {phase === "checkin" && <button type="button" onClick={box.showHelp} className={outlinePill}>Help</button>}
        {phase === "help" && role === "founder" && (
          <Link href="/founder/something" onClick={() => box.setOpen(false)} className={outlinePill}>Talk an idea through</Link>
        )}
      </div>
    )
  } else if (phase === "resting") {
    body = <button type="button" onClick={box.askMore} className={outlinePill}>Ask me one anyway</button>
  } else if (phase === "done") {
    body = <Link href={profileHref} onClick={() => box.setOpen(false)} className={outlinePill}>Open my profile</Link>
  } else if (status === "loading") {
    // Holds the place of the next question's replies, so the panel doesn't jump.
    body = (
      <div className="flex gap-2" aria-hidden="true">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    )
  } else if (history.length === 0) {
    body = <button type="button" onClick={box.askMore} className={pillClass}>Ask me one</button>
  }

  if (!body) return null
  return (
    <div ref={ref} className="max-h-[45%] shrink-0 overflow-y-auto border-t border-line px-5 pb-5 pt-4">
      {body}
    </div>
  )
}
