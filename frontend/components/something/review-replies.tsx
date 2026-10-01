"use client"

import { useState } from "react"
import { ArrowUp } from "lucide-react"
import type { Reaction, ReviewView, Risk } from "@/lib/agent-transport"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------------------------------------
 * The two readers' real replies (agent phase C). Nothing's label, risks and splits are shown
 * exactly as the agent sent them; Something only adds how to address each (relay fidelity).
 * Blocks render whole when they arrive: no typewriter, no counting numbers (frontend_brief).
 * ---------------------------------------------------------------------------------------------- */

const NOTHING = "text-[#8fb8ff]"
const NOTHING_SOFT = "bg-[#8fb8ff]/10"
const EFFORT: Record<Risk["test"]["effort"], string> = { hours: "a few hours", days: "a few days", weeks: "a few weeks" }
const REACTABLE = new Set(["open", "stands", "needs_test"])

export function ReviewProgress({ text }: { text: string }) {
  return <p className="text-[15px] leading-relaxed text-muted-foreground" aria-live="polite">{text}</p>
}

export function NothingReply({
  review,
  busy,
  onReact,
}: {
  review: ReviewView
  busy: boolean
  onReact: (r: Reaction) => void
}) {
  const n = review.nothing
  if (!n) return null
  const canReact = review.status === "awaiting_reaction"
  return (
    <div className="space-y-5">
      <div>
        <span className={cn("inline-flex rounded-full px-3 py-1 text-sm", NOTHING_SOFT, NOTHING)}>{n.verdict.text}</span>
        <p className="mt-3 text-[15px] leading-relaxed">{n.verdict.meaning}</p>
        <p className="mt-1 text-sm text-muted-foreground">{n.verdict.about}</p>
      </div>

      {n.risks.length > 0 && (
        <ol className="space-y-4">
          {n.risks.map((r, i) => (
            <RiskItem key={r.id} risk={r} index={i} canReact={canReact && REACTABLE.has(r.status)} busy={busy}
              roundsLeft={Math.max(0, review.maxRounds - review.round)} onReact={onReact} />
          ))}
        </ol>
      )}

      {n.cannotJudge && <p className="text-sm text-muted-foreground">{n.cannotJudge}</p>}
    </div>
  )
}

function RiskItem({ risk: r, index, canReact, busy, roundsLeft, onReact }: {
  risk: Risk
  index: number
  canReact: boolean
  busy: boolean
  roundsLeft: number
  onReact: (r: Reaction) => void
}) {
  const [disputing, setDisputing] = useState(false)
  const [text, setText] = useState("")
  const send = () => {
    const t = text.trim()
    if (!t || busy) return
    onReact({ kind: "dispute", riskId: r.id, text: t })
    setDisputing(false)
    setText("")
  }
  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex items-baseline gap-3">
        <span className={cn("text-sm", NOTHING)}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-relaxed">{r.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{[r.categoryLabel, r.split.text].filter(Boolean).join(". ")}</p>
          {r.why && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{r.why}</p>}
          {r.quote && (
            <p className="mt-2 border-l-2 border-line pl-3 text-sm leading-relaxed text-muted-foreground">
              &ldquo;{r.quote}&rdquo;{r.founderStated && <span className="ml-1.5 text-xs">founder-stated</span>}
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed">
            <span className="text-muted-foreground">Cheapest test, {EFFORT[r.test.effort] ?? "a little time"}: </span>
            {r.test.text}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Settled when: {r.criteria}</p>

          {r.status !== "open" && (
            <p className={cn("mt-3 text-sm leading-relaxed", r.status === "resolved" || r.status === "accepted" ? "text-done" : "text-foreground/90")}>
              {r.statusText}{r.ruling ? ` ${r.ruling}` : ""}
            </p>
          )}

          {canReact && !disputing && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => onReact({ kind: "accept", riskId: r.id })}
                className="rounded-full border border-line px-3.5 py-1.5 text-sm transition-colors hover:border-muted-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default">
                That&apos;s fair
              </button>
              <button type="button" disabled={busy} onClick={() => setDisputing(true)}
                className="rounded-full border border-line px-3.5 py-1.5 text-sm transition-colors hover:border-muted-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default">
                I disagree
              </button>
            </div>
          )}
          {canReact && disputing && (
            <div className="mt-3">
              <form onSubmit={(e) => { e.preventDefault(); send() }}
                className="flex items-end gap-2 rounded-[22px] border border-line bg-surface py-1.5 pl-4 pr-1.5 focus-within:border-muted-foreground/60">
                <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={2}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                  aria-label="What Nothing missed" placeholder="Tell Nothing what it missed. Evidence works best: numbers, names, links."
                  className="block min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none" />
                <button type="submit" disabled={busy || !text.trim()} aria-label="Send"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed">
                  <ArrowUp className="size-4" />
                </button>
              </form>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {roundsLeft > 0 ? `Arguments don't change it; evidence can. ${roundsLeft === 1 ? "One reply" : `${roundsLeft} replies`} left on this review.` : "No replies left on this review: it will show as disputed."}
                {" "}
                <button type="button" onClick={() => setDisputing(false)} className="underline underline-offset-4 hover:text-foreground cursor-pointer">Cancel</button>
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function SomethingReply({ review }: { review: ReviewView }) {
  const s = review.something
  if (!s) return null
  if (s.unavailable && !s.address.length) {
    return <p className="text-[15px] leading-relaxed text-muted-foreground">I couldn&apos;t read this one just now. Nothing&apos;s review above stands on its own.</p>
  }
  const titles = new Map((review.nothing?.risks ?? []).map((r, i) => [r.id, `${i + 1}. ${r.title}`]))
  return (
    <div className="space-y-5">
      {s.strengths.length > 0 && (
        <section>
          <h4 className="text-sm text-muted-foreground">What&apos;s strong</h4>
          <ul className="mt-2 space-y-1.5">
            {s.strengths.map((x) => (
              <li key={x.text} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                {x.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {s.address.length > 0 && (
        <section>
          <h4 className="text-sm text-muted-foreground">How to answer Nothing</h4>
          <ul className="mt-2 space-y-3">
            {s.address.map((a) => (
              <li key={a.riskId} className="text-[15px] leading-relaxed">
                {titles.get(a.riskId) && <span className="block text-sm text-muted-foreground">{titles.get(a.riskId)}</span>}
                {a.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {s.nextProof && (
        <section>
          <h4 className="text-sm text-muted-foreground">The strongest proof to show next</h4>
          <p className="mt-2 text-[15px] leading-relaxed">{s.nextProof}</p>
        </section>
      )}
    </div>
  )
}
