"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"

import apiClient from "@/lib/axios"
import { apiError, cn } from "@/lib/utils"
import { Page, PageTitle, countOf, pillClass, quietLinkClass } from "@/components/shell/page"
import { toast } from "@/components/ui/use-toast"
import { IdeaCard } from "@/components/visual/idea-card"
import { Skeleton } from "@/components/visual/skeleton"
import { labelFor, normalizeList, options } from "@/lib/taxonomy"
import { useJustInTimeQuestion } from "@/components/something-box/provider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"

type Project = {
  id: string
  name: string
  author: string
  domains: string[]
  desc: string
  stage: string
  postedAt: string | null
  location: string   // the founder's own words, "" when unset
  locationId: string // a locations id, "other", or "" when unset
  raising: string    // a raisingBands id, "" when unset
  authorAvatar: string
  milestones: { status: "open" | "done" }[]
}

// Shape a raw Idea doc from /ideas/discover into our Project type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeIdea = (raw: any): Project => ({
  id:               raw._id ?? raw.id,
  name:             raw.title ?? "Untitled",
  author:           raw.author ?? "",
  domains:          normalizeList("sectors", raw.tags ?? []),
  desc:             raw.desc  ?? raw.description ?? "",
  stage:            raw.stage ?? "",
  postedAt:         raw.createdAt ?? null,
  location:         raw.founderLocation ?? "",
  locationId:       raw.locationId ?? "",
  raising:          raw.raising ?? "",
  authorAvatar:     raw.founderAvatar ?? "",
  milestones:       raw.milestones ?? [],
})

// Ids from shared/taxonomy.json; idea tags are normalized to the same ids. Location comes from the
// founder's profile, matched to a known place by the API ("other" when it isn't one).
const ALL_DOMAINS = options("sectors")
const ALL_STAGES = options("ideaStages")
const ALL_RAISING = options("raisingBands")
const locationLabel = (id: string) => (id === "other" ? "Elsewhere" : labelFor("locations", id))

type WhenKey = "any" | "30d" | "90d" | "1y"

export default function InvestorSearchPage() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ghostMode, setGhostMode] = useState(false)

  // Fetch ideas from the real API on mount
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true)
    setLoadError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiClient.get<any[]>("/ideas/discover")
      setProjects(res.data.map(normalizeIdea))
    } catch (err) {
      setLoadError(apiError(err, "Couldn't load ideas."))
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGhostMode(localStorage.getItem("investor_ghost_mode") === "true")
      const handleGhost = (e: Event) => {
        const ce = e as CustomEvent<{ ghost: boolean }>
        if (ce.detail) setGhostMode(ce.detail.ghost)
      }
      window.addEventListener("ghost-mode-change", handleGhost)
      return () => window.removeEventListener("ghost-mode-change", handleGhost)
    }
  }, [])

  // Saved ideas live on the server (the investor's pipeline starts here). Ideas saved in this
  // browser before that are copied up once, then the browser copy is removed.
  const [watchlistedIds, setWatchlistedIds] = useState<string[]>([])

  useEffect(() => {
    const LEGACY_KEY = "investor_watchlisted_ids"
    const load = async () => {
      let legacy: string[] = []
      try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") } catch { legacy = [] }
      if (legacy.length) {
        await Promise.allSettled(legacy.map((id) => apiClient.post(`/investor/watchlist/${id}`, {})))
        try { localStorage.removeItem(LEGACY_KEY) } catch { /* private mode */ }
      }
      const res = await apiClient.get<{ ids: string[] }>("/investor/watchlist")
      setWatchlistedIds(res.data.ids)
    }
    load().catch(() => setWatchlistedIds([]))
  }, [])

  const toggleWatchlist = async (id: string) => {
    const saved = watchlistedIds.includes(id)
    setWatchlistedIds((ids) => (saved ? ids.filter((x) => x !== id) : [...ids, id]))
    try {
      if (saved) await apiClient.delete(`/investor/watchlist/${id}`)
      else await apiClient.post(`/investor/watchlist/${id}`, {})
    } catch (err) {
      setWatchlistedIds((ids) => (saved ? [...ids, id] : ids.filter((x) => x !== id)))
      toast({ title: saved ? "Not removed" : "Not saved", description: apiError(err, "Please try again."), variant: "destructive" })
    }
  }

  // Top search
  const [q, setQ] = useState("")

  // Filters in sheet
  const [open, setOpen] = useState(false)
  const [selectedDomains, setSelectedDomainsState] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [postedWhen, setPostedWhen] = useState<WhenKey>("any")
  const [selectedRaising, setSelectedRaising] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [includeUntagged, setIncludeUntagged] = useState(false)

  // Sectors start from the investor's profile ("From your profile"), until they change them by hand.
  const [domainsFromProfile, setDomainsFromProfile] = useState(false)
  const domainsTouched = useRef(false)
  const setSelectedDomains = (v: string[]) => {
    domainsTouched.current = true
    setDomainsFromProfile(false)
    setSelectedDomainsState(v)
  }
  const prefillFromProfile = useCallback(async () => {
    if (domainsTouched.current) return
    try {
      const res = await apiClient.get<{ interests?: string[] }>("/investor/profile")
      const sectors = normalizeList("sectors", res.data.interests ?? [])
      if (!domainsTouched.current && sectors.length) {
        setSelectedDomainsState(sectors)
        setDomainsFromProfile(true)
      }
    } catch {
      // no prefill; the search still works
    }
  }, [])

  // Prefill on load, and again when the Something box saves the investor's sectors.
  useEffect(() => {
    prefillFromProfile()
    window.addEventListener("profile:updated", prefillFromProfile)
    return () => window.removeEventListener("profile:updated", prefillFromProfile)
  }, [prefillFromProfile])

  const params = useSearchParams()

  // Matching needs the investor's sectors and stages; ask for a missing one right here.
  useJustInTimeQuestion("investor_matching")

  // Open filters if URL has filters=1 or openFilters=true; seed q if present
  useEffect(() => {
    const shouldOpen = params.get("filters") === "1" || params.get("openFilters") === "true"
    if (shouldOpen) setOpen(true)
    const initialQ = params.get("q")
    if (initialQ) setQ(initialQ)
  }, [params])

  // Active filter count (exclude defaults)
  const activeCount = (selectedDomains.length ? 1 : 0) + (selectedStages.length ? 1 : 0) + (postedWhen !== "any" ? 1 : 0)
    + (selectedRaising.length ? 1 : 0) + (selectedLocations.length ? 1 : 0)

  // Results — filter the API-sourced projects
  const { results, hiddenUntagged } = useMemo(() => {
    let hiddenUntagged = 0
    const results = projects.filter((p) => {
      const s = q.trim().toLowerCase()
      if (s) {
        const hay = `${p.name} ${p.author} ${p.desc} ${p.domains.map((d) => labelFor("sectors", d)).join(" ")} ${p.location}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (selectedStages.length > 0 && !selectedStages.includes(p.stage)) return false
      if (selectedRaising.length > 0 && !selectedRaising.includes(p.raising)) return false
      if (selectedLocations.length > 0 && !selectedLocations.includes(p.locationId)) return false
      if (!matchesWhen(p, postedWhen)) return false
      if (selectedDomains.length > 0 && !p.domains.some((d) => selectedDomains.includes(d))) {
        // An idea whose founder hasn't picked a sector yet isn't a mismatch; count it and offer to show it.
        if (p.domains.length === 0) {
          if (includeUntagged) return true
          hiddenUntagged++
        }
        return false
      }
      return true
    })
    return { results, hiddenUntagged }
  }, [projects, q, selectedDomains, selectedStages, postedWhen, selectedRaising, selectedLocations, includeUntagged])

  // Only places some founder is actually in, most ideas first.
  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of projects) if (p.locationId) counts.set(p.locationId, (counts.get(p.locationId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => ({ value, label: locationLabel(value) }))
  }, [projects])

  const facetState: FacetState = {
    selectedDomains, setSelectedDomains, selectedStages, setSelectedStages, postedWhen, setPostedWhen,
    selectedRaising, setSelectedRaising, selectedLocations, setSelectedLocations, locationOptions,
  }

  function resetFilters() {
    setSelectedRaising([])
    setSelectedLocations([])
    setSelectedDomains([])
    setSelectedStages([])
    setPostedWhen("any")
    setIncludeUntagged(false)
  }

  return (
    <Page>
      <PageTitle title="Discover">
        {ghostMode
          ? "Ghost Mode is on: founders don't see you in their view counts."
          : "Ideas founders have made public, newest first."}
      </PageTitle>

      {/* Laptops (xl): the filters stay open in a rail on the left; phones use the Filter sheet. */}
      <div className="mt-12 xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-x-16">
        <aside aria-label="Filters" className="hidden xl:block xl:sticky xl:top-16 xl:self-start">
          <Facets state={facetState} />
          {activeCount > 0 && (
            <button type="button" onClick={resetFilters} className={cn(quietLinkClass, "mt-8")}>Clear all</button>
          )}
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              aria-label="Search ideas"
              placeholder="A sector, a problem, a founder's name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-full border border-input bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
            />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger className={cn(quietLinkClass, "shrink-0 self-start sm:self-auto xl:hidden", activeCount > 0 && "text-foreground")}>
                Filter{activeCount > 0 ? ` (${activeCount})` : ""}
              </SheetTrigger>
              <FiltersSheet onReset={resetFilters} state={facetState} />
            </Sheet>
          </div>

          {domainsFromProfile && selectedDomains.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Showing {andList(selectedDomains.map((d) => labelFor("sectors", d)))} from your profile.{" "}
              <button type="button" onClick={() => setSelectedDomains([])} className="underline underline-offset-4 hover:text-foreground cursor-pointer">
                Show all sectors
              </button>
            </p>
          )}

          {!loadingProjects && !loadError && (
            <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">{countOf(results.length, "idea")}</p>
          )}

          <div className="mt-4">
            {loadingProjects ? (
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 2xl:grid-cols-3" role="status" aria-label="Loading ideas">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div role="alert" className="flex items-baseline gap-5">
                <p className="text-[15px] text-destructive">{loadError}</p>
                <button type="button" onClick={fetchProjects} className={quietLinkClass}>Retry</button>
              </div>
            ) : results.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">No ideas match. Try another search or fewer filters.</p>
            ) : (
              <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 2xl:grid-cols-3">
                {results.map((r) => {
                  const starred = watchlistedIds.includes(r.id)
                  return (
                    <li key={r.id}>
                      <IdeaCard
                        href={`/investor/search/${r.id}`}
                        idea={{
                          id: r.id,
                          title: r.name,
                          description: r.desc,
                          sectors: r.domains,
                          stage: r.stage,
                          raising: r.raising,
                          author: r.author,
                          authorAvatar: r.authorAvatar,
                          location: r.location,
                          createdAt: r.postedAt,
                          milestones: r.milestones,
                        }}
                        action={
                          <button
                            type="button"
                            onClick={() => toggleWatchlist(r.id)}
                            aria-pressed={starred}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer",
                              starred ? "border-gold/40 bg-gold-soft text-gold" : "border-line text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {starred ? "Saved" : "Save"}
                          </button>
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
            {!loadingProjects && !loadError && hiddenUntagged > 0 && !includeUntagged && (
              <p className="mt-6 text-sm text-muted-foreground">
                {hiddenUntagged} {hiddenUntagged === 1 ? "idea has" : "ideas have"} no sector yet.{" "}
                <button type="button" onClick={() => setIncludeUntagged(true)} className="underline underline-offset-4 hover:text-foreground cursor-pointer">
                  Show {hiddenUntagged === 1 ? "it" : "them"}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}

/* Filters sheet component */
type FacetState = {
  selectedDomains: string[]
  setSelectedDomains: (v: string[]) => void
  selectedStages: string[]
  setSelectedStages: (v: string[]) => void
  postedWhen: WhenKey
  setPostedWhen: (v: WhenKey) => void
  selectedRaising: string[]
  setSelectedRaising: (v: string[]) => void
  selectedLocations: string[]
  setSelectedLocations: (v: string[]) => void
  locationOptions: { value: string; label: string }[]
}

function FiltersSheet({ onReset, state }: { onReset: () => void; state: FacetState }) {
  return (
    <SheetContent side="right" className="w-full sm:max-w-md bg-popover border-l border-border text-popover-foreground flex flex-col h-full p-8">
      <SheetHeader className="p-0">
        <SheetTitle className="text-2xl font-medium text-foreground">Filter</SheetTitle>
        <SheetDescription className="text-[15px] text-muted-foreground">Pick as many as you like.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto pr-1 py-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        <Facets state={state} />
      </div>

      <SheetFooter className="mt-auto flex-row items-center justify-end gap-5 p-0 pt-6 border-t border-border">
        <button type="button" onClick={onReset} className={quietLinkClass}>Clear all</button>
        <SheetClose className={pillClass}>Show results</SheetClose>
      </SheetFooter>
    </SheetContent>
  )
}

/** The Sectors / Stage / Posted chips: in the phone sheet and in the laptop rail. */
function Facets({ state }: { state: FacetState }) {
  const {
    selectedDomains, setSelectedDomains, selectedStages, setSelectedStages, postedWhen, setPostedWhen,
    selectedRaising, setSelectedRaising, selectedLocations, setSelectedLocations, locationOptions,
  } = state
  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
      on ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground",
    )
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="space-y-8">
      <FacetBlock title="Sectors">
        <div className="flex flex-wrap gap-2">
          {ALL_DOMAINS.map(({ value: d, label }) => {
            const on = selectedDomains.includes(d)
            return (
              <button key={d} onClick={() => setSelectedDomains(toggle(selectedDomains, d))} className={chip(on)} aria-pressed={on}>
                {label}
              </button>
            )
          })}
        </div>
      </FacetBlock>

      <FacetBlock title="Stage">
        <div className="flex flex-wrap gap-2">
          {ALL_STAGES.map(({ value: st, label }) => {
            const on = selectedStages.includes(st)
            return (
              <button key={st} onClick={() => setSelectedStages(toggle(selectedStages, st))} className={chip(on)} aria-pressed={on}>
                {label}
              </button>
            )
          })}
        </div>
      </FacetBlock>

      <FacetBlock title="Raising">
        <div className="flex flex-wrap gap-2">
          {ALL_RAISING.map(({ value, label }) => {
            const on = selectedRaising.includes(value)
            return (
              <button key={value} onClick={() => setSelectedRaising(toggle(selectedRaising, value))} className={chip(on)} aria-pressed={on}>
                {label}
              </button>
            )
          })}
        </div>
      </FacetBlock>

      {locationOptions.length > 0 && (
        <FacetBlock title="Founder location">
          <div className="flex flex-wrap gap-2">
            {locationOptions.map(({ value, label }) => {
              const on = selectedLocations.includes(value)
              return (
                <button key={value} onClick={() => setSelectedLocations(toggle(selectedLocations, value))} className={chip(on)} aria-pressed={on}>
                  {label}
                </button>
              )
            })}
          </div>
        </FacetBlock>
      )}

      <FacetBlock title="Posted">
        <div className="flex flex-wrap gap-2">
          {[
            { k: "any", label: "Any time" },
            { k: "30d", label: "Last 30 days" },
            { k: "90d", label: "Last 90 days" },
            { k: "1y",  label: "Over a year ago" },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setPostedWhen(o.k as WhenKey)}
              className={chip(postedWhen === o.k)}
              aria-pressed={postedWhen === o.k}
            >
              {o.label}
            </button>
          ))}
        </div>
      </FacetBlock>
    </div>
  )
}

/* Helpers */
function diffDaysFromNow(iso: string) {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}
function matchesWhen(p: Project, w: WhenKey) {
  if (w === "any") return true
  if (!p.postedAt) return false
  const d = diffDaysFromNow(p.postedAt)
  if (w === "30d") return d <= 30
  if (w === "90d") return d <= 90
  if (w === "1y") return d > 365
  return true
}
/** "A", "A and B", "A, B and C" */
function andList(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}
function FacetBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <div className="text-[15px] text-foreground">{title}</div>
      {children}
    </div>
  )
}
