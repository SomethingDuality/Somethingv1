import Link from "next/link"
import { Section } from "@/components/shell/page"

export type Step = { label: string; href: string; done: boolean }

/**
 * The first-run steps on a home page, from real state (an idea posted, a profile filled in...).
 * Done steps stay listed so the list reads as progress; the section goes away when all are done.
 */
export function GettingStarted({ steps }: { steps: Step[] }) {
  const left = steps.filter((s) => !s.done).length
  if (left === 0) return null
  return (
    <Section title="Getting started" action={<span>{steps.length - left} of {steps.length} done</span>}>
      <div className="mb-4 flex gap-1" aria-hidden="true">
        {steps.map((s) => (
          <span key={s.label} className={s.done ? "h-1 flex-1 rounded-full bg-done" : "h-1 flex-1 rounded-full bg-line"} />
        ))}
      </div>
      <ul className="divide-y divide-border">
        {steps.map((s) => (
          <li key={s.label} className="flex items-baseline justify-between gap-6 py-3.5">
            {s.done ? (
              <span className="text-[15px] text-muted-foreground line-through decoration-muted-foreground/60">{s.label}</span>
            ) : (
              <Link href={s.href} className="text-[15px] text-foreground hover:underline underline-offset-4">{s.label}</Link>
            )}
            <span className="shrink-0 text-xs text-done">{s.done ? "Done" : ""}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
