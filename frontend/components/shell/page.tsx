import type React from "react"
import { cn } from "@/lib/utils"
import { money, when } from "@/lib/format"

/**
 * Page building blocks for the logged-in app (chat/frontend_brief.md, Part 4), laptop-first:
 * pages use up to 1200px; on xl (≥1280) a page can split into a main column and a side
 * column (Split/Main/Aside). Phones get one column. Long text keeps its own ~65ch measure.
 * "reading" (720px) is only for text-only pages (Diligence, Terms).
 */
export function Page({ width = "wide", className, children }: {
  width?: "wide" | "reading"
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("w-full", width === "reading" ? "max-w-[720px]" : "max-w-[1200px]", className)}>
      {children}
    </div>
  )
}

/**
 * Main column + side column on xl. Children keep the phone order in the DOM; on xl, <Aside>
 * moves to the right column (from the top) and every <Main> (up to five) stacks on the left.
 * The last row is 1fr so a tall side column adds space at the bottom, not between Mains.
 */
export function Split({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[repeat(5,auto)_1fr] xl:items-start xl:gap-x-20", className)}>
      {children}
    </div>
  )
}

export function Main({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("min-w-0 xl:col-start-1", className)}>{children}</div>
}

/** The side column. Its first Section has no top margin on xl, so it lines up with the page. */
export function Aside({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <aside
      className={cn(
        "min-w-0 xl:col-start-2 xl:row-span-6 xl:row-start-1 xl:sticky xl:top-16 xl:[&>section:first-child]:mt-0",
        className,
      )}
    >
      {children}
    </aside>
  )
}

/** The page's one heading, an optional plain sentence under it, and actions on the right. */
export function PageTitle({ title, children, actions }: {
  title: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[32px] leading-[1.15] text-foreground lg:text-[44px] lg:leading-[1.1]">{title}</h1>
        {children && <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{children}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  )
}

/**
 * A section: a small heading (only when it helps someone find their way) and its content.
 * `side` puts the heading in a 240px left column on xl (settings-style pages).
 */
export function Section({ title, action, side = false, className, children }: {
  title?: React.ReactNode
  action?: React.ReactNode
  side?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("mt-20", side && "xl:grid xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-16", className)}>
      {(title || action) && (
        <div className={cn("mb-5 flex items-baseline justify-between gap-4", side && "xl:mb-0 xl:flex-col xl:justify-start")}>
          {title && <h2 className="text-lg text-foreground xl:text-2xl">{title}</h2>}
          {action && <div className="text-[15px] text-muted-foreground">{action}</div>}
        </div>
      )}
      {side ? <div className="min-w-0">{children}</div> : children}
    </section>
  )
}

/** The primary action: a white pill, as on the landing page. */
export const pillClass =
  "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-foreground px-5 text-[15px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"

/** A quiet secondary action: plain text. */
export const quietLinkClass = "text-[15px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"

/** "1 idea", "3 ideas". */
export const countOf = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "$1,500". */
export const usd = (n: number | null | undefined) => money(n)

export function greeting(name?: string | null, now = new Date()) {
  const h = now.getHours()
  const part = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  const first = (name || "").trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}

/** "just now", "3 h ago", "2 days ago", then "1 Oct" (lib/format.ts `when`). */
export const relativeTime = (iso?: string | null) => when(iso)
