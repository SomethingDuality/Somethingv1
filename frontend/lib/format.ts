// One way to show dates and money across the interior.

// Built once: toLocaleDateString / toLocaleString build a new formatter on every call, which
// adds up across a long list (about 60 times slower than reusing one).
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
const DOLLARS = new Intl.NumberFormat("en-US")

const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear()

/** "just now", "5 min ago", "3 h ago", "2 days ago", then "1 Oct" (or "1 Oct 2025" in another year). */
export function when(iso?: string | Date | null): string {
  if (!iso) return ""
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  const days = Math.round(mins / (60 * 24))
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  return dateLabel(d)
}

/** "1 Oct" this year, "1 Oct 2025" otherwise. */
export function dateLabel(iso?: string | Date | null): string {
  if (!iso) return ""
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return (sameYear(d) ? DAY_MONTH : DAY_MONTH_YEAR).format(d)
}

/** "$1,500"; "$1.2M" / "$45k" when `short`. */
export function money(n: number | null | undefined, { short = false } = {}): string {
  const v = Number(n || 0)
  if (short && v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`
  if (short && v >= 10_000) return `$${Math.round(v / 1000)}k`
  return `$${DOLLARS.format(v)}`
}
