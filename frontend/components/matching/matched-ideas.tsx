"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { Section } from "@/components/shell/page"
import { SkeletonRows } from "@/components/visual/skeleton"
import { dealFlowApi, type DealFlow, type DealFlowMatch } from "@/lib/agent-transport"
import { labelFor } from "@/lib/taxonomy"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------------------------------------
 * Matched deal flow, every 7 days (agent: interim matcher now, Prapti's Brain later).
 * Investors: ideas that fit their sectors, stages and checks. Founders: ideas looking for someone
 * with their skills. Each match says why, in plain words; no scores. If the agent isn't reachable
 * the section simply isn't shown.
 * ---------------------------------------------------------------------------------------------- */

/** Lower-case a label inside a sentence, keeping acronyms ("ML engineer", "AI / ML"). */
const inSentence = (label: string) => {
  const first = label.split(" ")[0]
  return /[A-Z]/.test(first.slice(1)) || first === first.toUpperCase() ? label : label.charAt(0).toLowerCase() + label.slice(1)
}
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })

export function MatchedIdeas({ role }: { role: "investor" | "founder" }) {
  const [flow, setFlow] = useState<DealFlow | null | undefined>(undefined)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())

  useEffect(() => {
    dealFlowApi.get().then(setFlow).catch(() => setFlow(null))
  }, [])

  if (flow === null) return null
  const title = role === "investor" ? "Matched for you this week" : "Ideas looking for someone like you"
  const next = flow ? <span>Next on {day(flow.batch.nextAt)}</span> : undefined

  const pass = (m: DealFlowMatch) => {
    setHidden((h) => new Set(h).add(m.id))
    dealFlowApi.act(m.id, "passed").catch(() => setHidden((h) => { const n = new Set(h); n.delete(m.id); return n }))
  }
  const save = async (m: DealFlowMatch) => {
    setSaved((s) => new Set(s).add(m.id))
    try {
      await apiClient.post(`/investor/watchlist/${m.ideaId}`)
      await dealFlowApi.act(m.id, "saved")
    } catch {
      setSaved((s) => { const n = new Set(s); n.delete(m.id); return n })
    }
  }
  const href = (m: DealFlowMatch) => (role === "investor" ? `/investor/search/${m.ideaId}` : `/founder/ideas/${m.ideaId}`)
  const shown = flow?.matches.filter((m) => !hidden.has(m.id) && m.status !== "passed") ?? []

  return (
    <Section title={title} action={next}>
      {flow === undefined ? (
        <SkeletonRows />
      ) : flow.need ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {flow.need}{" "}
          <Link href={`/${role}/profile`} className="text-foreground underline underline-offset-4">Open your profile</Link>
        </p>
      ) : shown.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {flow.matches.length ? "That's all for this week." : "Nothing new fits you this week."} New matches come every 7 days.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((m) => {
            const meta = role === "investor"
              ? [m.idea.stageLabel, m.idea.raisingLabel && `Raising ${m.idea.raisingLabel}`, m.idea.location].filter(Boolean)
              : [m.idea.lookingFor.length ? `Looking for ${m.idea.lookingFor.map(inSentence).join(", ")}` : null, m.idea.location].filter(Boolean)
            return (
              <li key={m.id} className="py-5 first:pt-0">
                <Link href={href(m)} onClick={() => { dealFlowApi.act(m.id, "opened").catch(() => {}) }} className="text-base text-foreground hover:underline underline-offset-4">
                  {m.idea.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[...m.idea.sectors.slice(0, 2).map((s) => labelFor("sectors", s)), ...meta].join(". ")}
                </p>
                {m.idea.excerpt && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-foreground/90">{m.idea.excerpt}</p>}
                <ul className="mt-2 space-y-1">
                  {m.reasons.slice(0, 3).map((r) => (
                    <li key={r} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-[8px] size-1 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {role === "investor" ? (
                    <button type="button" disabled={saved.has(m.id) || m.status === "saved"} onClick={() => save(m)}
                      className={cn("rounded-full border border-line px-3.5 py-1.5 text-sm transition-colors cursor-pointer disabled:cursor-default",
                        saved.has(m.id) || m.status === "saved" ? "text-done" : "hover:border-muted-foreground")}>
                      {saved.has(m.id) || m.status === "saved" ? "Saved" : "Save"}
                    </button>
                  ) : (
                    <Link href={href(m)} onClick={() => { dealFlowApi.act(m.id, "opened").catch(() => {}) }}
                      className="rounded-full border border-line px-3.5 py-1.5 text-sm transition-colors hover:border-muted-foreground">
                      See the idea
                    </Link>
                  )}
                  <button type="button" onClick={() => pass(m)}
                    className="rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
                    Not for me
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/** On a founder's own idea: how many people it was matched to lately. Counts only, never who. */
export function IdeaReach({ ideaId }: { ideaId: string }) {
  const [reach, setReach] = useState<{ investors: number; founders: number } | null>(null)
  useEffect(() => {
    dealFlowApi.reach(ideaId).then(setReach).catch(() => setReach(null))
  }, [ideaId])
  if (!reach) return null
  const parts = [
    reach.investors ? `${reach.investors} ${reach.investors === 1 ? "investor" : "investors"}` : null,
    reach.founders ? `${reach.founders} ${reach.founders === 1 ? "founder" : "founders"} whose skills fit` : null,
  ].filter(Boolean)
  return (
    <Section title="Matched this week">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        {parts.length
          ? `Shown to ${parts.join(" and ")}. Who they are stays private until they reach out.`
          : "Not matched to anyone yet this week. Matches go out every 7 days; sectors, stage and who you're looking for help it find the right people."}
      </p>
    </Section>
  )
}
