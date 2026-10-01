// One way to show dates and money across the interior.

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
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear(d) ? {} : { year: "numeric" }) })
}

/** "$1,500"; "$1.2M" / "$45k" when `short`. */
export function money(n: number | null | undefined, { short = false } = {}): string {
  const v = Number(n || 0)
  if (short && v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`
  if (short && v >= 10_000) return `$${Math.round(v / 1000)}k`
  return `$${v.toLocaleString("en-US")}`
}
