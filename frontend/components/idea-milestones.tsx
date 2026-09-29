"use client"

import { useState } from "react"
import apiClient from "@/lib/axios"
import { Section, pillClass, quietLinkClass } from "@/components/shell/page"
import { apiError } from "@/lib/utils"
import { MilestoneTrack } from "@/components/visual/milestone-track"
import { dateLabel } from "@/lib/format"

export type Milestone = { id: string; title: string; status: "open" | "done"; doneAt: string | null; proof?: string }

const MAX = 10

/** The API sends milestones as subdocuments (`_id`); routes answer with `id`. */
export const toMilestone = (m: { _id?: string; id?: string; title: string; status: "open" | "done"; doneAt?: string | null; proof?: string }): Milestone =>
  ({ id: String(m.id ?? m._id), title: m.title, status: m.status, doneAt: m.doneAt ?? null, proof: m.proof ?? "" })

/**
 * What the founder will show progress on. The owner adds, ticks and removes milestones; marking
 * one done tells the investors who committed. Others see the list, and a committed investor gets
 * `action` next to done milestones (e.g. "Record a release").
 */
export function IdeaMilestones({
  ideaId,
  milestones,
  isOwner,
  onChange,
  action,
  released,
}: {
  ideaId: string
  milestones: Milestone[]
  isOwner: boolean
  onChange: (next: Milestone[]) => void
  action?: (m: Milestone) => React.ReactNode
  /** Amount released against each milestone (by this investor, or by everyone for the founder). */
  released?: Record<string, number>
}) {
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const call = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (err) { setError(apiError(err, "That didn't save. Please try again.")) } finally { setBusy(false) }
  }

  const add = () => call(async () => {
    const t = title.trim()
    if (!t) return
    const res = await apiClient.post(`/ideas/${ideaId}/milestones`, { title: t })
    onChange([...milestones, toMilestone(res.data)])
    setTitle("")
  })
  const setStatus = (m: Milestone, status: "open" | "done") => call(async () => {
    const res = await apiClient.put(`/ideas/${ideaId}/milestones/${m.id}`, { status })
    onChange(milestones.map((x) => (x.id === m.id ? toMilestone(res.data) : x)))
  })
  const remove = (m: Milestone) => call(async () => {
    await apiClient.delete(`/ideas/${ideaId}/milestones/${m.id}`)
    onChange(milestones.filter((x) => x.id !== m.id))
  })

  if (!isOwner && milestones.length === 0) return null

  return (
    <Section title="Milestones">
      {milestones.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          No milestones yet. Add the steps you&apos;ll show progress on; investors who committed can record a release when one is done.
        </p>
      ) : (
        <MilestoneTrack milestones={milestones} released={released} className="rounded-2xl border border-line bg-surface p-6" />
      )}
      {/* Owners edit the list; a committed investor gets their actions on done milestones. */}
      {milestones.length > 0 && (isOwner || action) && (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-6 py-4">
              <span className={m.status === "done" ? "text-[15px] text-muted-foreground" : "text-[15px]"}>
                {m.title}
                {m.status === "done" && m.doneAt && <span className="ml-3 text-xs">Done {dateLabel(m.doneAt)}</span>}
              </span>
              <span className="flex shrink-0 items-baseline gap-5 text-sm">
                {isOwner ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => setStatus(m, m.status === "done" ? "open" : "done")} className={`${quietLinkClass} text-sm`}>
                      {m.status === "done" ? "Reopen" : "Mark done"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => remove(m)} className={`${quietLinkClass} text-sm`}>Remove</button>
                  </>
                ) : m.status === "done" ? (
                  action?.(m) ?? <span className="text-xs text-done">Done</span>
                ) : (
                  <span className="text-xs text-muted-foreground">In progress</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {isOwner && milestones.length < MAX && (
        <form onSubmit={(e) => { e.preventDefault(); add() }} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="New milestone"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. First 10 paying customers"
            className="h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-full border border-input bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
          />
          <button type="submit" disabled={busy || !title.trim()} className={pillClass}>Add milestone</button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-[15px] text-destructive">{error}</p>}
    </Section>
  )
}
