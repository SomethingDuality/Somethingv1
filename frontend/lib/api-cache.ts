// A small per-user cache for the GETs pages share and come back to (profiles, idea lists, the
// watchlist, the portfolio, deal flow, leaderboards). A page returning from navigation paints what
// this tab already has at once and asks again in the background (stale-while-revalidate); two
// components asking at once share one request. Entries belong to the signed-in user: another user,
// signing out or the session expiring empties it, and a successful write marks what it changed as
// stale (still painted, but always asked again).
import apiClient, { onMutation } from "@/lib/axios"

/** Within this, a cached answer is used without asking. */
const FRESH_MS = 30_000
/** Older than this, it isn't shown at all: the page loads as it would without a cache. */
const KEEP_MS = 10 * 60_000

// Only these exact URLs (leaderboards with their query). Never GET /ideas/:id: every read of it
// counts a view.
const CACHEABLE = /^\/(founder\/profile|investor\/profile|ideas\/user|ideas\/discover|investor\/watchlist|investor\/portfolio|agent\/deal-flow|leaderboards\/[a-z]+(\?[^/]*)?)$/

// What a successful write makes stale, by its path (first match wins).
const WRITES: [RegExp, string[]][] = [
  [/^\/auth\/refresh$/, []],
  [/^\/auth\//, [""]], // signing in, out, deleting the account: everything
  [/^\/ideas(\/|$)/, ["/ideas/", "/leaderboards/", "/agent/deal-flow"]], // posts, edits, files, milestones, comments, support
  [/^\/investor\/(watchlist|commit|portfolio)/, ["/investor/watchlist", "/investor/portfolio", "/agent/deal-flow"]],
  [/^\/investor\//, ["/investor/profile", "/agent/deal-flow"]], // profile, interests, preferences, photo, Ghost Mode
  [/^\/founder\/(profile|avatar)/, ["/founder/profile", "/agent/deal-flow"]],
  [/^\/questions\/[^/]+\/answer$/, ["/founder/profile", "/investor/profile", "/ideas/", "/agent/deal-flow"]],
  [/^\/agent\/deal-flow\//, ["/agent/deal-flow"]],
  [/^\/problems/, ["/leaderboards/"]],
  [/^\/teams\//, ["/ideas/user"]],
]

type Entry = { data: unknown; at: number; stale?: boolean }

let owner: string | null = null
/** Bumped by every clear and invalidation: an answer requested before one isn't stored. */
let generation = 0
const entries = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()

const usable = (url: string) => typeof window !== "undefined" && owner !== null && CACHEABLE.test(url)

export function clearCache() {
  entries.clear()
  inflight.clear()
  generation++
}

/** Whose data this is (AuthProvider). A different user, or none, empties the cache first. */
export function setCacheOwner(userId: string | null) {
  if (userId === owner) return
  clearCache()
  owner = userId
}

/** Marks every entry whose URL starts with one of these paths ("" for all) as stale: it still
 *  paints, but the next read asks the server. A request already on its way may predate the
 *  change, so it isn't shared or stored. */
export function invalidate(...paths: string[]) {
  const hit = (key: string) => paths.some((p) => key.startsWith(p))
  for (const [key, e] of entries) if (hit(key)) e.stale = true
  for (const key of [...inflight.keys()]) if (hit(key)) inflight.delete(key)
  generation++
}

/** The paths a successful write makes stale. */
export function staleAfter(path: string): string[] {
  return WRITES.find(([re]) => re.test(path))?.[1] ?? []
}

/** What this tab has for `url`, when recent enough to show: for a page's first paint. */
export function cached<T>(url: string): T | undefined {
  if (!usable(url)) return undefined
  const e = entries.get(url)
  return e && Date.now() - e.at < KEEP_MS ? (e.data as T) : undefined
}

function fetchShared<T>(url: string): Promise<T> {
  const running = inflight.get(url) as Promise<T> | undefined
  if (running) return running
  const gen = generation
  const p: Promise<T> = apiClient
    .get<T>(url)
    .then((r) => {
      if (gen === generation && usable(url)) entries.set(url, { data: r.data, at: Date.now() })
      return r.data
    })
    .finally(() => {
      if (inflight.get(url) === p) inflight.delete(url)
    })
  inflight.set(url, p)
  return p
}

/**
 * A GET through the cache. `onData` gets what this tab has right away, then the server's answer
 * if that was stale or missing (not again when nothing changed). Rejects only when there was
 * nothing to show; a failed check of something already shown keeps it. `fresh` skips what this
 * tab has: for a reload right after the page's own write, which the old answer would undo.
 */
export async function cachedGet<T>(url: string, onData: (data: T) => void, { fresh = false } = {}): Promise<void> {
  if (!usable(url)) {
    onData((await apiClient.get<T>(url)).data)
    return
  }
  const e = fresh ? undefined : entries.get(url)
  const age = e ? Date.now() - e.at : Infinity
  const shown = e !== undefined && age < KEEP_MS
  if (shown) onData(e.data as T)
  if (age < FRESH_MS && !e?.stale) return
  try {
    const data = await fetchShared<T>(url)
    if (!shown || JSON.stringify(data) !== JSON.stringify(e.data)) onData(data)
  } catch (err) {
    if (!shown) throw err
  }
}

if (typeof window !== "undefined") {
  onMutation((_method, path) => {
    const stale = staleAfter(path)
    if (stale.length) invalidate(...stale)
  })
  // Someone else signed in, or the session ended: nothing cached may be shown to the next person.
  window.addEventListener("auth:login", clearCache)
  window.addEventListener("auth:expired", () => setCacheOwner(null))
  // The Something box saved an answer to the profile or an idea.
  window.addEventListener("profile:updated", () =>
    invalidate("/founder/profile", "/investor/profile", "/ideas/", "/agent/deal-flow"),
  )
}
