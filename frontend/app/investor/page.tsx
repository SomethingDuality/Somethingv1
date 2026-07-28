"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"

import { TrendingUp, MessageSquare, DollarSign, Layers, ArrowRight, RefreshCw } from "lucide-react"
import { ConciergeRail } from "@/components/concierge-rail"
import { cn } from "@/lib/utils"
import { OnboardingModal } from "@/components/onboarding-modal"
import { InvestorWeeklySummary } from "@/components/investor-weekly-summary"

// ── Types ─────────────────────────────────────────────────────────────────
interface KpiData {
  availableBalance: string
  committedCapital: string
  activeProjects:   number
  unreadChats:      number
}

interface PipelineProject {
  id:    string
  name:  string
  stage: "assess" | "match" | "mobilize"
}

interface Activity {
  id:          string
  description: string
  timestamp:   string
}

interface InvestorDashboardData {
  kpis:           KpiData
  pipeline:       PipelineProject[]
  recentActivity: Activity[]
}

interface Row {
  id: string
  name: string
  stage: string
  location: string
  trustPoints: number
  committed: number
  released: number
  perf: string
  next: string
}

interface Milestone {
  id: string
  title: string
  amount: string
  status: "Released" | "Pending Verification" | "Active" | "Locked"
  description: string
}

// ── KPI metadata ──────────────────────────────────────────────────────────
const KPI_META = [
  { key: "availableBalance", label: "Available balance", icon: DollarSign },
  { key: "committedCapital", label: "Committed capital", icon: TrendingUp },
  { key: "activeProjects",   label: "Active projects",   icon: Layers },
  { key: "unreadChats",      label: "Unread messages",   icon: MessageSquare },
]

// ── Pipeline stage config ─────────────────────────────────────────────────
const STAGE_CONFIG = [
  { key: "assess",   label: "Assess",   desc: "Evaluating fit"   },
  { key: "match",    label: "Match",    desc: "Terms in review"  },
  { key: "mobilize", label: "Mobilize", desc: "Capital moving"   },
] as const

// ─── Count-up helper ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    let cur = 0
    const inc = target / 36
    const t = setInterval(() => {
      cur += inc
      if (cur >= target) {
        setCount(target)
        clearInterval(t)
      } else {
        setCount(Math.floor(cur))
      }
    }, duration / 36)
    return () => clearInterval(t)
  }, [target, duration])
  return count
}

// ── Section Label ────────────────────────────────────────────────────────────
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground", className)}>
      {children}
    </p>
  )
}

// ── Kpi Stat Component ───────────────────────────────────────────────────────
function KpiStat({ label, rawValue, isCurrency, icon: Icon, loading }: {
  label: string; rawValue: string | number; isCurrency?: boolean; icon: React.ComponentType<{ className?: string }>; loading: boolean
}) {
  const isNumber = typeof rawValue === "number" || (!isNaN(Number(rawValue.toString().replace(/[^0-9.-]+/g, ""))));
  const numericVal = isNumber ? Number(rawValue.toString().replace(/[^0-9.-]+/g, "")) : 0;
  const count = useCountUp(numericVal);
  
  let display = rawValue.toString();
  if (isNumber && !loading) {
    display = isCurrency ? `$${count.toLocaleString()}` : count.toLocaleString();
  }

  return (
    <div className="group transition-all duration-300">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-3xl font-serif font-light text-foreground tracking-tight group-hover:scale-[1.01] duration-300 origin-left transition-transform">
        {loading ? (
          <span className="inline-block h-7 w-24 bg-foreground/5 rounded animate-pulse" />
        ) : (
          display
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
export default function InvestorOverviewPage() {
  const [data, setData] = useState<InvestorDashboardData>({
    kpis: {
      availableBalance: "$1,000,000",
      committedCapital: "$0",
      activeProjects: 0,
      unreadChats: 0
    },
    pipeline: [],
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Custom synced lists
  const [interestsList, setInterestsList] = useState<string[]>([])
  const [portfolioList, setPortfolioList] = useState<Row[]>([])
  const [milestonesList, setMilestonesList] = useState<Milestone[]>([])

  // Onboarding
  const [onboardingPlan, setOnboardingPlan] = useState("nothing")
  const [onboardingName, setOnboardingName] = useState("Investor")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOnboardingPlan(localStorage.getItem("selected_plan") || "nothing")
      setOnboardingName(localStorage.getItem("demo_name") || "Investor")
    }
  }, [])

  useEffect(() => {
    fetchData()

    const syncHandler = () => {
      fetchData()
    }
    window.addEventListener("founder-milestones-updated", syncHandler)
    window.addEventListener("investor-profile-update", syncHandler)
    return () => {
      window.removeEventListener("founder-milestones-updated", syncHandler)
      window.removeEventListener("investor-profile-update", syncHandler)
    }
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch real portfolio from backend
      type PortfolioResponse = { data: Row[]; totalCommitted: number; totalReleased: number }
      let currentPortfolio: Row[] = []
      let totalCapitalPool = 1000000

      try {
        const portfolioRes = await apiClient.get<PortfolioResponse>("/investor/portfolio")
        if (portfolioRes.data.data?.length > 0) {
          currentPortfolio = portfolioRes.data.data
          // Cache locally so other pages stay in sync
          localStorage.setItem("investor_portfolio", JSON.stringify(currentPortfolio))
        }
      } catch {
        // Fall back to localStorage cache
        const portfolioStr = localStorage.getItem("investor_portfolio")
        if (portfolioStr) {
          try { currentPortfolio = JSON.parse(portfolioStr) } catch { /* keep empty */ }
        }
      }
      setPortfolioList(currentPortfolio)

      // 2. Get interests + capital pool from profile cache (no separate API call needed)
      let profileInterests: string[] = []
      const profileStr = localStorage.getItem("investor_profile_data")
      if (profileStr) {
        try {
          const parsed = JSON.parse(profileStr)
          if (parsed.interests?.length > 0) profileInterests = parsed.interests
          if (typeof parsed.totalCapitalPool !== "undefined") {
            totalCapitalPool = Number(parsed.totalCapitalPool) || 1000000
          }
        } catch { /* ignore */ }
      }
      setInterestsList(profileInterests)

      // 3. Get milestones from localStorage (milestone API not yet built)
      let currentMilestones: Milestone[] = []
      const milestonesStr = localStorage.getItem("founder_milestones")
      if (milestonesStr) {
        try { currentMilestones = JSON.parse(milestonesStr) } catch { /* ignore */ }
      }
      setMilestonesList(currentMilestones)

      const pending = currentMilestones.filter(m => m.status === "Pending Verification")

      // 4. Compute KPIs from real portfolio data
      const totalCommitted = currentPortfolio.reduce((acc, c) => acc + c.committed, 0)
      const remainingBalance = Math.max(0, totalCapitalPool - totalCommitted)

      const dynamicPipeline: PipelineProject[] = currentPortfolio.map(p => {
        let stage: "assess" | "match" | "mobilize" = "assess"
        if (p.released > 0) {
          stage = p.released >= p.committed ? "mobilize" : "match"
        }
        return { id: p.id, name: p.name, stage }
      })

      const dynamicActivity: Activity[] = pending.map((m, idx) => ({
        id: `pending-${idx}`,
        description: `Milestone payout requested: ${m.title} — ${m.amount}`,
        timestamp: "Just now"
      }))

      setData({
        kpis: {
          availableBalance: `$${remainingBalance.toLocaleString()}`,
          committedCapital: `$${totalCommitted.toLocaleString()}`,
          activeProjects: currentPortfolio.length,
          unreadChats: pending.length,
        },
        pipeline: dynamicPipeline,
        recentActivity: dynamicActivity
      })
    } catch (err) {
      console.error(err)
      setError("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  const byStage = {
    assess:   data.pipeline.filter(p => p.stage === "assess"),
    match:    data.pipeline.filter(p => p.stage === "match"),
    mobilize: data.pipeline.filter(p => p.stage === "mobilize"),
  }

  // Filter pending milestones for Concierge passing
  const pendingMilestonesOnly = milestonesList.filter(m => m.status === "Pending Verification")

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10">
      {/* Onboarding modal — only shows once for new signups */}
      <OnboardingModal role="investor" plan={onboardingPlan} userName={onboardingName} />
      <div className="flex flex-col lg:flex-row gap-10 xl:gap-14">
        {/* ── Main column ── */}
        <div className="min-w-0 flex-1 space-y-16">

          {/* Page header */}
          <div className="space-y-1.5 pb-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--brand-accent)" }}
              />
              System Overview
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground leading-tight">
              Capital Overview
            </h1>
            <p className="text-sm text-muted-foreground font-sans max-w-lg mt-1 leading-relaxed">
              Allocate capital nodes, track dealflow pipeline, and verify cohort evidence logs.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500 font-mono">
              {error}{" "}
              <button onClick={fetchData} className="underline underline-offset-2 ml-2 inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Retry
              </button>
            </div>
          )}

          {/* ── KPIs (Clean Minimal Row) ── */}
          <div className="py-8 border-y border-border/[0.04]">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {KPI_META.map(({ key, label, icon: Icon }) => {
                const raw = data.kpis[key as keyof KpiData]
                const isCurrency = key === "availableBalance" || key === "committedCapital";
                return (
                  <KpiStat
                    key={key}
                    label={label}
                    rawValue={raw}
                    isCurrency={isCurrency}
                    icon={Icon}
                    loading={loading}
                  />
                )
              })}
            </div>
          </div>

          {/* ── Weekly Signal & Thesis Digest ── */}
          <InvestorWeeklySummary />

          {/* ── Pipeline ── */}
          <div className="space-y-8">
            <div className="flex items-baseline justify-between border-b border-border/[0.03] pb-4">
              <div className="space-y-1">
                <SectionLabel>Investment pipeline</SectionLabel>
                <p className="text-xs text-muted-foreground">Dealflow status and fit assessments.</p>
              </div>
              <Link
                href="/investor/investments"
                className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand-accent hover:text-brand-accent/80 transition-colors flex items-center gap-1 font-semibold"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-8 lg:gap-10 sm:grid-cols-3">
              {STAGE_CONFIG.map(({ key, label, desc }) => (
                <div key={key} className="space-y-6">
                  <div className="flex items-center justify-between pb-2 border-b border-border/10">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: "var(--brand-accent)" }}
                      />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/80 font-semibold">
                        {label}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                      {desc}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {byStage[key].map(p => (
                      <li key={p.id}>
                        <Link
                          href={`/investor/search/${p.id}`}
                          className="block px-4 py-3.5 text-xs text-foreground/80 hover:text-foreground rounded-lg border border-border/15 bg-card/10 backdrop-blur-xl hover:bg-card/15 hover:border-border/30 transition-all font-sans shadow-sm"
                        >
                          {p.name}
                        </Link>
                      </li>
                    ))}
                    {byStage[key].length === 0 && (
                      <li className="px-3 py-3 text-[10px] text-muted-foreground italic font-mono uppercase tracking-wider">
                        No submissions.
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* ── Cohort Leaderboard ── */}
          <div className="space-y-8 pt-6">
            <div className="border-b border-border/[0.03] pb-4">
              <SectionLabel>Cohort Leaderboard</SectionLabel>
              <p className="text-xs text-muted-foreground mt-1">Top-ranked projects based on community upvote conviction.</p>
            </div>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="text-[11px] text-muted-foreground font-mono text-center py-8">No ranked projects yet.</div>
            </div>
          </div>

          {/* ── Activity ── */}
          <div className="space-y-6 pt-4">
            <div className="border-b border-border/[0.03] pb-4">
              <SectionLabel>Recent activity log</SectionLabel>
              <p className="text-xs text-muted-foreground mt-1">Real-time status updates and milestone confirmations.</p>
            </div>
            <ul className="divide-y divide-border/[0.03]">
              {data.recentActivity.map((act) => {
                const getActivityHref = (desc: string) => {
                  const lower = desc.toLowerCase()
                  if (lower.includes("message") || lower.includes("sent")) return "/investor/chats"
                  if (lower.includes("milestone") || lower.includes("funds released")) return "/investor/investments"
                  if (lower.includes("suggested") || lower.includes("climate")) return "/investor/search/p2"
                  if (lower.includes("nda") || lower.includes("neurotech")) return "/investor/search/p4"
                  return "/investor/search"
                }
                return (
                  <Link
                    key={act.id}
                    href={getActivityHref(act.description)}
                    className="flex items-start gap-4 py-4 hover:px-2 rounded-lg -mx-2 hover:bg-foreground/[0.01] transition-all cursor-pointer block border border-transparent"
                  >
                    <span
                      className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: "var(--brand-accent)", opacity: 0.6 }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-[13px] text-foreground/80 font-sans leading-relaxed hover:text-foreground/90">
                        {act.description}
                      </p>
                      <span className="text-[8.5px] font-mono text-muted-foreground uppercase tracking-wider mt-1 block">
                        {act.timestamp}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </ul>
          </div>

        </div>

        {/* ── Concierge rail ── */}
        <ConciergeRail 
          interests={interestsList} 
          pendingMilestones={pendingMilestonesOnly} 
          portfolio={portfolioList} 
        />
      </div>
    </div>
  )
}