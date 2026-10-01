"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { Section } from "@/components/shell/page"
import { IdeaCover } from "@/components/visual/idea-cover"
import { SkeletonRows } from "@/components/visual/skeleton"
import { cn } from "@/lib/utils"

type Row = { id: string; title?: string; text?: string; tags: string[]; count: number }
type Range = "week" | "all"

/**
 * What people back most (community C4): ideas by supporters, problems by votes, this week or
 * all time. Counts only, never who; no points or prizes (the competition is parked, F10).
 */
export function LeaderboardCard({ kind, role, title, sectors, className }: {
  kind: "ideas" | "problems"
  role: "founder" | "investor"
  title: string
  /** Ideas only: limit to these sectors (e.g. the investor's). */
  sectors?: string[]
  className?: string
}) {
  const [range, setRange] = useState<Range>("week")
  const [rows, setRows] = useState<Row[] | null>(null)
  const sectorKey = (sectors ?? []).join(",")

  useEffect(() => {
    let live = true
    setRows(null)
    const qs = new URLSearchParams({ window: range, limit: "5" })
    if (kind === "ideas" && sectorKey) qs.set("sectors", sectorKey)
    apiClient.get<Row[]>(`/leaderboards/${kind}?${qs}`)
      .then((r) => { if (live) setRows(r.data) })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [kind, range, sectorKey])

  const hrefFor = (r: Row) =>
    kind === "problems" ? `/${role}/problems?p=${r.id}`
    : role === "investor" ? `/investor/search/${r.id}` : `/founder/ideas/${r.id}`

  const countLabel = (n: number) =>
    kind === "ideas"
      ? range === "week" ? `${n} this week` : `${n} ${n === 1 ? "supporter" : "supporters"}`
      : range === "week" ? `+${n} this week` : `+${n}`

  return (
    <Section
      title={title}
      className={className}
      action={
        <span className="flex gap-3" role="tablist" aria-label={`${title}: time range`}>
          {(["week", "all"] as const).map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={range === w}
              onClick={() => setRange(w)}
              className={cn("text-[13px] transition-colors cursor-pointer", range === w ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {w === "week" ? "This week" : "All time"}
            </button>
          ))}
        </span>
      }
    >
      {rows === null ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          {range === "week"
            ? `Nothing ${kind === "ideas" ? "supported" : "voted up"} this week yet.`
            : kind === "ideas" ? "No supporters yet." : "No votes yet."}
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={r.id}>
              <Link href={hrefFor(r)} className="group flex items-center gap-3 py-3">
                <span className="w-4 shrink-0 text-[13px] tabular-nums text-muted-foreground">{i + 1}</span>
                {kind === "ideas" && <IdeaCover id={r.id} sectors={r.tags} className="size-9 shrink-0" rounded="rounded-lg" />}
                <span className={cn("min-w-0 flex-1 text-[15px] underline-offset-4 group-hover:underline", kind === "ideas" ? "truncate" : "line-clamp-2 leading-snug")}>
                  {kind === "ideas" ? r.title : r.text}
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground">{countLabel(r.count)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
