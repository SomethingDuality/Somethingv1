"use client"

import type React from "react"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { SearchIcon, SlidersHorizontal, Lock, EyeOff, Star, Loader2 } from "lucide-react"

import apiClient from "@/lib/axios"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConciergeRail } from "@/components/concierge-rail"
import { cn } from "@/lib/utils"
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
  domains: string[]
  desc: string
  stage: "Pre‑seed" | "Seed" | "Angel" | "Series A" | string
  launchedAt: string | null
  trustPoints: number
  location: string
  investmentNeeded: number
}

// Shape a raw Idea doc from /ideas/discover into our Project type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeIdea = (raw: any): Project => ({
  id:               raw._id ?? raw.id,
  name:             raw.title ?? "Untitled",
  domains:          raw.tags  ?? [],
  desc:             raw.desc  ?? raw.description ?? "",
  stage:            raw.stage ?? "concept",
  launchedAt:       raw.createdAt ?? null,
  trustPoints:      75,           // default baseline — trust comes from investor model, not idea
  location:         raw.location  ?? "Remote",
  investmentNeeded: raw.fundingGoal ?? 0,
})

const ALL_DOMAINS = [
  "Climate hardware", "Edge AI", "Local‑first", "Bio tooling",
  "DePIN", "Robotics", "Creator infra", "Privacy",
]
const ALL_LOCATIONS = ["Remote", "SF Bay", "NYC", "Berlin", "London", "Bengaluru", "Singapore"]

// Empty fallback — show no results when API is unreachable
const FALLBACK: Project[] = []

type WhenKey = "any" | "30d" | "90d" | "1y" | "pre"

export default function InvestorSearchPage() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [ghostMode, setGhostMode] = useState(false)

  // Fetch ideas from the real API on mount
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiClient.get<any[]>("/ideas/discover")
      setProjects(res.data.map(normalizeIdea))
    } catch {
      setProjects(FALLBACK)
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

  const [watchlistedIds, setWatchlistedIds] = useState<string[]>([])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("investor_watchlisted_ids")
      if (stored) {
        try {
          setWatchlistedIds(JSON.parse(stored))
        } catch {
          setWatchlistedIds([])
        }
      }
    }
  }, [])

  const toggleWatchlist = (id: string) => {
    const updated = watchlistedIds.includes(id)
      ? watchlistedIds.filter((x) => x !== id)
      : [...watchlistedIds, id]
    setWatchlistedIds(updated)
    localStorage.setItem("investor_watchlisted_ids", JSON.stringify(updated))
  }

  // Top search
  const [q, setQ] = useState("")

  // Filters in sheet
  const [open, setOpen] = useState(false)
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [launchedWhen, setLaunchedWhen] = useState<WhenKey>("any")
  const [minTrust, setMinTrust] = useState<number>(75)
  const [investMin, setInvestMin] = useState<number>(0)
  const [investMax, setInvestMax] = useState<number>(60000)

  const params = useSearchParams()

  // Open filters if URL has filters=1 or openFilters=true; seed q if present
  useEffect(() => {
    const shouldOpen = params.get("filters") === "1" || params.get("openFilters") === "true"
    if (shouldOpen) setOpen(true)
    const initialQ = params.get("q")
    if (initialQ) setQ(initialQ)
  }, [params])

  // Keep min/max consistent
  useEffect(() => {
    if (investMin > investMax) setInvestMax(investMin)
  }, [investMin])
  useEffect(() => {
    if (investMax < investMin) setInvestMin(investMax)
  }, [investMax])

  // Active filter count (exclude defaults)
  const activeCount = useMemo(() => {
    let c = 0
    if (selectedDomains.length) c++
    if (selectedLocations.length) c++
    if (launchedWhen !== "any") c++
    if (minTrust !== 75) c++
    if (investMin > 0) c++
    if (investMax < 100000) c++
    return c
  }, [selectedDomains.length, selectedLocations.length, launchedWhen, minTrust, investMin, investMax])

  // Results — filter the API-sourced projects
  const results = useMemo(() => {
    return projects.filter((p) => {
      const s = q.trim().toLowerCase()
      if (s) {
        const hay = `${p.name} ${p.desc} ${p.domains.join(" ")} ${p.location}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (selectedDomains.length > 0 && !p.domains.some((d) => selectedDomains.includes(d))) return false
      if (selectedLocations.length > 0 && !selectedLocations.includes(p.location)) return false
      if (!matchesWhen(p, launchedWhen)) return false
      if (p.trustPoints < minTrust) return false
      if (p.investmentNeeded < investMin || p.investmentNeeded > investMax) return false
      return true
    })
  }, [q, selectedDomains, selectedLocations, launchedWhen, minTrust, investMin, investMax])

  function resetFilters() {
    setSelectedDomains([])
    setSelectedLocations([])
    setLaunchedWhen("any")
    setMinTrust(75)
    setInvestMin(0)
    setInvestMax(60000)
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10">
      {ghostMode && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 flex items-center gap-3 text-xs text-violet-400 font-mono mb-6">
          <EyeOff className="h-4 w-4 shrink-0 text-violet-400" />
          <div>
            <strong>Ghost Mode Active:</strong> You are browsing startup dealflow stealthily. Founders will not receive view or engagement signals.
          </div>
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-10 xl:gap-14">
        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-12">
          
          {/* Header */}
          <div className="space-y-1.5 pb-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--brand-accent)" }}
              />
              Dealflow Discover
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground leading-tight">
              Discover Projects
            </h1>
            <p className="text-sm text-muted-foreground font-sans max-w-lg mt-1 leading-relaxed">
              Explore cohort project briefs, filter by domain, or evaluate milestone telemetry metrics.
            </p>
          </div>

          {/* Top filter bar */}
          <div className="rounded-xl border border-border/[0.04] bg-background/20 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
                <Input
                  placeholder="Domains, founders, keywords…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-9.5 w-full pl-9 bg-accent/30 border-border/[0.03] text-foreground placeholder:text-foreground/30 rounded-lg focus-visible:ring-brand-accent/30 focus-visible:border-brand-accent/20 transition-all font-sans"
                />
              </div>

              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9.5 rounded-lg border-border/40 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent transition-all",
                      activeCount > 0 && "border-border text-foreground",
                    )}
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters{activeCount > 0 ? ` (${activeCount})` : ""}
                  </Button>
                </SheetTrigger>
                <FiltersSheet
                  onReset={resetFilters}
                  state={{
                    selectedDomains,
                    setSelectedDomains,
                    selectedLocations,
                    setSelectedLocations,
                    launchedWhen,
                    setLaunchedWhen,
                    minTrust,
                    setMinTrust,
                    investMin,
                    setInvestMin,
                    investMax,
                    setInvestMax,
                  }}
                />
              </Sheet>
            </div>
          </div>

          {/* Minimal results list */}
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground pb-2 border-b border-border/[0.03] mb-2">
              Results ({loadingProjects ? "…" : results.length})
            </p>
            
            {loadingProjects ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
              </div>
            ) : results.length === 0 ? (
              <div className="p-12 text-xs text-muted-foreground font-mono text-center border border-border/[0.03] rounded-xl bg-foreground/[0.01]">
                No projects match your filters. Try broadening.
              </div>
            ) : (
              <div className="divide-y divide-border/[0.03]">
                {results.map((r) => (
                  <div
                    key={r.id}
                    className="py-7 px-4 rounded-xl border border-transparent hover:border-border/15 hover:bg-card/10 backdrop-blur-xl transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground group-hover:text-brand-accent transition-colors">
                            {r.name}
                          </span>
                          <Badge variant="secondary" className="bg-accent/40 text-foreground border-border/40 text-[9px] font-mono px-2 py-0.5 rounded">
                            {r.stage}
                          </Badge>
                          <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5 text-[9px] font-mono flex items-center gap-1 rounded px-1.5 py-0.5">
                            <Lock className="h-2.5 w-2.5" /> mNDA
                          </Badge>
                          {r.domains.map((d) => (
                            <Badge key={d} variant="secondary" className="bg-accent/20 text-muted-foreground border-border/10 text-[9px] px-1.5 py-0.5 rounded">
                              {d}
                            </Badge>
                          ))}
                          <span className="text-xs text-muted-foreground">· {r.location}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-2xl">{r.desc}</p>
                        <div className="text-[11px] text-muted-foreground/80 font-mono">
                          {launchedLabel(r.launchedAt)} · Needs{" "}
                          <span className="text-foreground font-medium">{formatUSD(r.investmentNeeded)}</span>
                        </div>
                      </div>
                      <div className="sm:ml-4 flex items-center justify-between sm:justify-end gap-5 shrink-0">
                        {(() => {
                          const tp = clamp(r.trustPoints, 1, 100)
                          const delta = tp - 75
                          const deltaStr = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`
                          return (
                            <span className="text-xs text-muted-foreground">
                              Trust <span className="font-semibold text-foreground">{tp}</span>
                              <span className={cn("ml-1 text-[10px] font-mono", delta > 0 ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-muted-foreground")}>
                                ({deltaStr})
                              </span>
                            </span>
                          )
                        })()}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleWatchlist(r.id)}
                            className={cn(
                              "size-8 rounded-full border flex items-center justify-center transition-all cursor-pointer",
                              watchlistedIds.includes(r.id)
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                : "bg-transparent border-border/40 text-foreground/45 hover:text-foreground hover:bg-accent/40"
                            )}
                            title={watchlistedIds.includes(r.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                            aria-label={watchlistedIds.includes(r.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                          >
                            <Star className={cn("h-3.5 w-3.5", watchlistedIds.includes(r.id) ? "fill-amber-500" : "")} />
                          </button>
                          <Button asChild size="sm" className="h-8 rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs px-3.5 cursor-pointer">
                            <Link href={`/investor/search/${r.id}`}>View brief</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Concierge rail (right) */}
        <ConciergeRail />
      </div>
    </div>
  )
}

/* Filters sheet component */
function FiltersSheet({
  onReset,
  state,
}: {
  onReset: () => void
  state: {
    selectedDomains: string[]
    setSelectedDomains: (v: string[]) => void
    selectedLocations: string[]
    setSelectedLocations: (v: string[]) => void
    launchedWhen: WhenKey
    setLaunchedWhen: (v: WhenKey) => void
    minTrust: number
    setMinTrust: (v: number) => void
    investMin: number
    setInvestMin: (v: number) => void
    investMax: number
    setInvestMax: (v: number) => void
  }
}) {
  const {
    selectedDomains,
    setSelectedDomains,
    selectedLocations,
    setSelectedLocations,
    launchedWhen,
    setLaunchedWhen,
    minTrust,
    setMinTrust,
    investMin,
    setInvestMin,
    investMax,
    setInvestMax,
  } = state

  return (
    <SheetContent side="right" className="w-full sm:max-w-md bg-popover/95 border-l border-border/40 backdrop-blur-xl text-popover-foreground flex flex-col h-full shadow-2xl p-6">
      <SheetHeader className="pb-4 border-b border-border/10">
        <SheetTitle className="font-serif font-light text-xl text-foreground">Filters</SheetTitle>
        <SheetDescription className="text-muted-foreground text-xs font-mono">Narrow your search to the right opportunities.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto pr-1 py-6 space-y-8 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        <FacetBlock title="Domain(s)">
          <div className="flex flex-wrap gap-2">
            {ALL_DOMAINS.map((d) => {
              const on = selectedDomains.includes(d)
              return (
                <button
                  key={d}
                  onClick={() =>
                    setSelectedDomains(on ? selectedDomains.filter((x) => x !== d) : [...selectedDomains, d])
                  }
                  className={cn(
                    "text-xs rounded-full px-3 py-1.5 border transition-all cursor-pointer",
                    on
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground"
                      : "border-border/60 text-foreground/60 hover:bg-accent/40",
                  )}
                  aria-pressed={on}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </FacetBlock>

        <FacetBlock title="Location">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_LOCATIONS.map((loc) => {
              const on = selectedLocations.includes(loc)
              return (
                <button
                  key={loc}
                  onClick={() =>
                    setSelectedLocations(
                      on ? selectedLocations.filter((x) => x !== loc) : [...selectedLocations, loc],
                    )
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all cursor-pointer text-left w-full",
                    on 
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground" 
                      : "border-border/60 text-foreground/60 hover:bg-accent/40",
                  )}
                >
                  <div className={cn(
                    "size-3.5 rounded border flex items-center justify-center shrink-0 transition-all",
                    on ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]" : "border-border/40 bg-transparent"
                  )}>
                    {on && (
                      <svg className="size-2 text-background stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <span>{loc}</span>
                </button>
              )
            })}
          </div>
        </FacetBlock>

        <FacetBlock title="Launched">
          <div className="flex flex-wrap gap-2">
            {[
              { k: "any", label: "Any" },
              { k: "30d", label: "Last 30d" },
              { k: "90d", label: "Last 90d" },
              { k: "1y",  label: "Older than 1y" },
              { k: "pre", label: "Pre‑launch" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setLaunchedWhen(o.k as WhenKey)}
                className={cn(
                  "text-xs rounded-full px-3 py-1.5 border transition-all cursor-pointer",
                  launchedWhen === o.k
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground"
                    : "border-border/60 text-foreground/60 hover:bg-accent/40",
                )}
                aria-pressed={launchedWhen === o.k}
              >
                {o.label}
              </button>
            ))}
          </div>
        </FacetBlock>

        <FacetBlock title="Trust points (min)">
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={minTrust}
                onChange={(e) => setMinTrust(Number.parseInt(e.target.value))}
                aria-label="Minimum trust points"
                className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-[var(--brand-accent)]"
              />
              <div className="w-16 text-right text-xs text-foreground/75 font-mono font-semibold">{minTrust} / 100</div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">Baseline 75 — signals raise or lower this.</div>
          </div>
        </FacetBlock>

        <FacetBlock title="Investment needed (USD)">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono w-6">Min</span>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={investMin}
                  onChange={(e) => setInvestMin(safeInt(e.target.value, investMin))}
                  className="h-9 bg-accent/20 border-border/40 text-foreground text-xs rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-brand-accent/25 focus-visible:border-brand-accent/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono w-6">Max</span>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={investMax}
                  onChange={(e) => setInvestMax(safeInt(e.target.value, investMax))}
                  className="h-9 bg-accent/20 border-border/40 text-foreground text-xs rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-brand-accent/25 focus-visible:border-brand-accent/30"
                />
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Range: ${investMin.toLocaleString()} – ${investMax.toLocaleString()}
            </div>
          </div>
        </FacetBlock>
      </div>

      <SheetFooter className="mt-auto pt-4 border-t border-border/10 flex items-center justify-end gap-2.5 shrink-0">
        <Button
          variant="outline"
          onClick={onReset}
          className="rounded-full border-border/40 text-foreground/60 hover:bg-accent/40 bg-transparent text-xs font-semibold px-5 h-9.5 cursor-pointer"
        >
          Reset
        </Button>
        <SheetClose asChild>
          <Button className="rounded-full bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold px-5 h-9.5 cursor-pointer">Apply</Button>
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  )
}

/* Helpers */
function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}
function diffDaysFromNow(iso: string) {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}
function matchesWhen(p: Project, w: WhenKey) {
  if (w === "any") return true
  if (w === "pre") return p.launchedAt == null
  if (!p.launchedAt) return false
  const d = diffDaysFromNow(p.launchedAt)
  if (w === "30d") return d <= 30
  if (w === "90d") return d <= 90
  if (w === "1y") return d > 365
  return true
}
function launchedLabel(iso: string | null) {
  if (!iso) return "Pre‑launch"
  const d = diffDaysFromNow(iso)
  if (d <= 30) return "Launched recently"
  if (d <= 90) return "Launched last 90d"
  if (d > 365) return "Launched 1y+ ago"
  return "Launched"
}
function formatUSD(n: number) {
  return `$${n.toLocaleString()}`
}
function safeInt(v: string, fallback: number) {
  const n = Number.parseInt(v)
  return Number.isFinite(n) ? n : fallback
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
function FacetBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}
