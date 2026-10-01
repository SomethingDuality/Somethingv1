import { cn } from "@/lib/utils"

export type MoneyRow = { label: string; value: string; tone?: "gold" | "done" | "plain" }

/**
 * Money is the one place numbers get size: a raised panel with the amounts that matter (all
 * real), what they mean underneath, and any actions. "No money moves on Something yet" stays
 * with it, because it's true.
 */
export function MoneyPanel({ rows, note, children, className }: { rows: MoneyRow[]; note?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-6", className)}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd
              className={cn(
                "mt-1 truncate text-[26px] font-light leading-none tracking-[-0.02em] tabular-nums",
                r.tone === "gold" ? "text-gold" : r.tone === "done" ? "text-done" : "text-foreground",
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{note}</p>}
      {children && <div className="mt-5 flex flex-wrap items-center gap-4">{children}</div>}
    </div>
  )
}
