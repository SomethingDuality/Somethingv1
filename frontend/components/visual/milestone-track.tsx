import { cn } from "@/lib/utils"
import { dateLabel, money } from "@/lib/format"

export type TrackMilestone = { id: string; title: string; status: "open" | "done"; doneAt?: string | null }

/**
 * Milestones as a vertical timeline, readable at any width: a progress bar and "2 of 3 done" on
 * top, then each step with its own line. Done steps are green with a check; what was released
 * against a step (when known) shows in gold under it.
 */
export function MilestoneTrack({
  milestones,
  released = {},
  className,
}: {
  milestones: TrackMilestone[]
  /** Released amount per milestone id. */
  released?: Record<string, number>
  className?: string
}) {
  if (milestones.length === 0) return null
  const done = milestones.filter((m) => m.status === "done").length
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[15px] text-foreground">
          {done} of {milestones.length} milestones done
        </p>
        {Object.values(released).some(Boolean) && (
          <p className="text-sm text-gold">{money(Object.values(released).reduce((a, b) => a + b, 0))} released</p>
        )}
      </div>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {milestones.map((m) => (
          <span key={m.id} className={cn("h-1.5 flex-1 rounded-full", m.status === "done" ? "bg-done" : "bg-line")} />
        ))}
      </div>

      <ol className="mt-6">
        {milestones.map((m, i) => {
          const isDone = m.status === "done"
          const last = i === milestones.length - 1
          return (
            <li key={m.id} className={cn("relative flex gap-4", !last && "pb-6")}>
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn("absolute left-[10px] top-6 bottom-0 w-0.5 rounded-full", isDone && milestones[i + 1]?.status === "done" ? "bg-done" : "bg-line")}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 mt-px grid size-[22px] shrink-0 place-items-center rounded-full border-2",
                  isDone ? "border-done bg-done text-background" : "border-line bg-background",
                )}
              >
                {isDone && (
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-base leading-snug", isDone ? "text-foreground" : "text-foreground/80")}>{m.title}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className={isDone ? "text-done" : "text-muted-foreground"}>
                    {isDone ? `Done ${dateLabel(m.doneAt)}` : "In progress"}
                  </span>
                  {released[m.id] ? <span className="text-gold">{money(released[m.id])} released</span> : null}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
