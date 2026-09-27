// Helpers over shared/taxonomy.json (synced into lib/shared by `node shared/sync.mjs`).
// The database stores ids (e.g. "ai_ml"); the UI shows labels. Unknown values are custom entries.
import taxonomy from "./shared/taxonomy.generated.json"

export type TaxonomyEntry = {
  id: string
  label: string
  aliases?: string[]
  description?: string
  typicalIdeaStages?: string[]
  min?: number
  max?: number
  value?: number
}

export type TaxonomyKind = Exclude<keyof typeof taxonomy, "version">

const key = (v: string) =>
  String(v).toLowerCase().normalize("NFKC").replace(/[‐-―\-_/\s]+/g, " ").trim()

const indexes = new Map<TaxonomyKind, Map<string, string>>()
for (const kind of Object.keys(taxonomy) as (TaxonomyKind | "version")[]) {
  if (kind === "version") continue
  const map = new Map<string, string>()
  for (const e of taxonomy[kind] as TaxonomyEntry[]) {
    map.set(key(e.id), e.id)
    map.set(key(e.label), e.id)
    for (const a of e.aliases ?? []) map.set(key(a), e.id)
  }
  indexes.set(kind, map)
}

export function list(kind: TaxonomyKind): TaxonomyEntry[] {
  return taxonomy[kind] as TaxonomyEntry[]
}

export function options(kind: TaxonomyKind) {
  return list(kind).map((e) => ({ value: e.id, label: e.label }))
}

/** Canonical id for a known value, the trimmed input for a custom one, null for empty. */
export function normalize(kind: TaxonomyKind, value: string | null | undefined): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (!s) return null
  return indexes.get(kind)?.get(key(s)) ?? s
}

export function normalizeList(kind: TaxonomyKind, values: readonly string[] | null | undefined): string[] {
  const out: string[] = []
  for (const v of values ?? []) {
    const n = normalize(kind, v)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

export function labelFor(kind: TaxonomyKind, value: string): string {
  return list(kind).find((e) => e.id === value)?.label ?? value
}
