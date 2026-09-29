"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUp, X } from "lucide-react"
import apiClient from "@/lib/axios"
import { useJustInTimeQuestion } from "@/components/something-box/provider"
import { Creature } from "@/components/creature/creature"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IdeaCover } from "@/components/visual/idea-cover"
import { SectorList } from "@/components/visual/idea-card"
import { markTriedSomething } from "@/lib/first-run"
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

export default function SomethingPage() {
  useJustInTimeQuestion("ai_review")
  const [ideas, setIdeas] = useState<SavedIdea[]>([])
  const [profileDone, setProfileDone] = useState(0)
  const [waitlist, setWaitlist] = useState<boolean | null>(null)

  const [text, setText] = useState("")
  const [picked, setPicked] = useState<SavedIdea | null>(null)
  const [readers, setReaders] = useState<Reader[]>(["something", "nothing"])
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiClient.get<SavedIdea[]>("/ideas/user").then((r) => setIdeas(r.data)).catch(() => setIdeas([]))
    apiClient.get<{ profileCompletion?: number }>("/founder/profile").then((r) => setProfileDone(r.data.profileCompletion ?? 0)).catch(() => {})
    apiClient.get<{ joined: boolean }>("/founder/review-waitlist").then((r) => setWaitlist(r.data.joined)).catch(() => setWaitlist(null))
  }, [])

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns])

  const canSend = !busy && (Boolean(picked) || text.trim().length > 0)

  const send = async () => {
    if (!canSend) return
    const id = Date.now()
    const turn: Turn = { id, text: picked ? picked.title : text.trim(), idea: picked, readers, overlaps: null, error: null }
    setTurns((t) => [...t, turn])
    setBusy(true)
    markTriedSomething()
    const body = picked ? { ideaId: picked._id } : { text: text.trim() }
    setText("")
    setPicked(null)
    try {
      const res = await apiClient.post<Overlaps>("/founder/overlaps", body)
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, overlaps: res.data } : x)))
    } catch (err) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: apiError(err, "Couldn't check right now.") } : x)))
    } finally {
      setBusy(false)
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
      text={text}
      setText={setText}
      picked={picked}
      setPicked={setPicked}
      ideas={ideas}
      readers={readers}
      setReaders={setReaders}
      canSend={canSend}
      onSend={send}
      busy={busy}
      compact={turns.length > 0}
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
          Their AI reviews aren&apos;t live yet. Overlaps and Readiness work today.{" "}
          We never use your ideas to build anything of ours, and we delete them when you ask.
        </p>
      </div>
    )
  }

  // A conversation: turns on top, the composer pinned at the bottom.
  return (
    <div className="mx-auto w-full max-w-[760px] pb-48">
      <ol className="space-y-16">
        {turns.map((turn, index) => (
          <li key={turn.id} className="space-y-6">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-surface-2 px-5 py-3.5">
                {turn.idea && (
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <IdeaCover id={turn.idea._id} sectors={turn.idea.tags} className="size-4" rounded="rounded-full" />
                    Your saved idea
                  </div>
                )}
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{turn.text}</p>
              </div>
            </div>

            {turn.readers.map((r) => (
              <ReaderReply key={r} reader={r} brief={index > 0} waitlist={waitlist} onWaitlist={toggleWaitlist} />
            ))}

            <ChecksReply turn={turn} profileDone={profileDone} />
          </li>
        ))}
      </ol>
      <div ref={endRef} />

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background from-60% to-transparent pb-6 pt-10 md:pl-56">
        <div className="mx-auto w-full max-w-[760px] px-5 md:px-12 lg:px-0">{composer}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------ */

function Composer({
  text,
  setText,
  picked,
  setPicked,
  ideas,
  readers,
  setReaders,
  canSend,
  onSend,
  busy,
  compact,
}: {
  text: string
  setText: (v: string) => void
  picked: SavedIdea | null
  setPicked: (v: SavedIdea | null) => void
  ideas: SavedIdea[]
  readers: Reader[]
  setReaders: (v: Reader[]) => void
  canSend: boolean
  onSend: () => void
  busy: boolean
  compact: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow with the text, up to a limit.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [text])

  const toggleReader = (r: Reader) =>
    setReaders(readers.includes(r) ? readers.filter((x) => x !== r) : [...readers, r])

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
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() }
            }}
            rows={compact ? 1 : 3}
            maxLength={2000}
            aria-label="Your idea"
            placeholder="What are you building?"
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
            onClick={onSend}
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

function ChecksReply({ turn, profileDone }: { turn: Turn; profileDone: number }) {
  return (
    <Speaker
      name="Checks that work today"
      color="text-muted-foreground"
      icon={<span className="grid size-9 place-items-center rounded-full bg-surface-2 text-xs text-muted-foreground">✓</span>}
    >
      {turn.error ? (
        <p role="alert" className="text-[15px] text-destructive">{turn.error}</p>
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
