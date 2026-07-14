"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { ConciergeRail } from "@/components/concierge-rail"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { FounderDialog, type Founder } from "@/components/founder-dialog"
import { cn } from "@/lib/utils"
import { Check, ExternalLink, ShieldCheck, AlertCircle, RefreshCw, Loader2, Lock, Coins, TrendingUp } from "lucide-react"

type Row = {
  id: string
  name: string
  stage: "Pre‑seed" | "Seed" | "Angel"
  location: string
  trustPoints: number
  committed: number
  released: number
  perf: string
  next: string
  founders: Founder[]
}

type PortfolioResponse = {
  data: Row[]
  totalCommitted: number
  totalReleased: number
}

interface Milestone {
  id: string
  title: string
  amount: string
  status: "Released" | "Pending Verification" | "Active" | "Locked"
  description: string
  submittedDate?: string
  releasedDate?: string
  proofLink?: string
  workSummary?: string
}

const BASELINE = 75

const DEFAULT_PORTFOLIO: Row[] = [
  {
    id: "p1",
    name: "Edge Vision Kit",
    stage: "Seed",
    location: "San Francisco, CA",
    trustPoints: 85,
    committed: 200000,
    released: 40000,
    perf: "Good",
    next: "Milestone 2: Alpha Application & Sync Engine",
    founders: [
      {
        id: "alex",
        name: "Alex Rivera",
        role: "Co-Founder & CTO",
        bio: "Former Distributed Systems Engineer at Ledger Inc. Berkeley CS.",
        links: [
          { label: "Twitter", href: "https://twitter.com/alex_rivera" },
          { label: "LinkedIn", href: "https://linkedin.com/in/alex-rivera-cs" }
        ]
      }
    ]
  },
  {
    id: "p2",
    name: "Climate Hardware v1",
    stage: "Pre‑seed",
    location: "Boston, MA",
    trustPoints: 76,
    committed: 100000,
    released: 20000,
    perf: "Stable",
    next: "Milestone 1: Prototype Core Specs",
    founders: [
      {
        id: "jane",
        name: "Jane Doe",
        role: "Lead Designer",
        bio: "Interaction designer specializing in physical interface systems.",
        links: [
          { label: "Twitter", href: "https://twitter.com/jane_doe" },
          { label: "LinkedIn", href: "https://linkedin.com/in/jane-doe-design" }
        ]
      }
    ]
  }
]

export default function InvestorInvestmentsPage() {
  const [portfolio, setPortfolio] = useState<Row[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [pendingMilestonesList, setPendingMilestonesList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCommitted, setTotalCommitted] = useState<number>(0)
  const [totalReleased, setTotalReleased] = useState<number>(0)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Tab State
  const [activeTab, setActiveTab] = useState<"portfolio" | "community">("portfolio")

  useEffect(() => {
    fetchPortfolio().then(() => {
      loadMilestones()
    })

    // Listen for custom events to keep local storage synced
    const syncHandler = () => {
      fetchPortfolio().then(() => {
        loadMilestones()
      })
    }
    window.addEventListener("founder-milestones-updated", syncHandler)
    window.addEventListener("global-projects-updated", syncHandler)
    return () => {
      window.removeEventListener("founder-milestones-updated", syncHandler)
      window.removeEventListener("global-projects-updated", syncHandler)
    }
  }, [])

  const [accreditedVerified, setAccreditedVerified] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAccreditedVerified(localStorage.getItem("investor_accredited_verified") === "true")
    }
  }, [])

  const loadMilestones = () => {
    if (typeof window !== "undefined") {
      const { getProjects } = require("@/lib/projects-store")
      const allProjects = getProjects()
      const pending: any[] = []
      
      const stored = localStorage.getItem("investor_portfolio")
      let portList: Row[] = []
      if (stored) {
        try {
          portList = JSON.parse(stored)
        } catch {
          portList = []
        }
      } else {
        portList = portfolio
      }

      portList.forEach((portItem: any) => {
        const fullProj = allProjects.find((x: any) => x.id === portItem.id)
        if (fullProj && fullProj.milestones) {
          fullProj.milestones.forEach((m: any) => {
            if (m.status === "Pending Verification") {
              pending.push({
                ...m,
                projectId: fullProj.id,
                projectName: fullProj.name
              })
            }
          })
        }
      })
      setPendingMilestonesList(pending)
    }
  }

  const fetchPortfolio = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Try fetching real API portfolio
      const response = await apiClient.get<PortfolioResponse>("/investor/portfolio")
      const apiData = response.data.data || []
      
      // Sync with projects-store to fill in any missing data or fields (like next milestone)
      const { getProjects } = require("@/lib/projects-store")
      const allProjects = getProjects()
      const synced = apiData.map((item: any) => {
        const matchingProject = allProjects.find((x: any) => x.id === item.id)
        if (matchingProject) {
          return {
            ...item,
            committed: item.committed || matchingProject.investmentNeeded,
            released: item.released || matchingProject.fundsGained,
            trustPoints: item.trustPoints || matchingProject.trustPoints
          }
        }
        return item
      })

      setPortfolio(synced)
      setTotalCommitted(response.data.totalCommitted || 0)
      setTotalReleased(response.data.totalReleased || 0)
      localStorage.setItem("investor_portfolio", JSON.stringify(synced))
    } catch (err) {
      console.warn("Failed to fetch API portfolio, loading from localStorage fallback:", err)
      const stored = localStorage.getItem("investor_portfolio")
      let parsed = []
      if (stored) {
        try {
          parsed = JSON.parse(stored)
        } catch {
          parsed = DEFAULT_PORTFOLIO
        }
      } else {
        parsed = DEFAULT_PORTFOLIO
      }
      
      const { getProjects } = require("@/lib/projects-store")
      const allProjects = getProjects()
      const synced = parsed.map((item: any) => {
        const matchingProject = allProjects.find((x: any) => x.id === item.id)
        if (matchingProject) {
          return {
            ...item,
            committed: matchingProject.investmentNeeded,
            released: matchingProject.fundsGained,
            trustPoints: matchingProject.trustPoints
          }
        }
        return item
      })

      setPortfolio(synced)
      calculateSums(synced)
      localStorage.setItem("investor_portfolio", JSON.stringify(synced))
    } finally {
      setLoading(false)
    }
  }

  const calculateSums = (list: Row[]) => {
    const committed = list.reduce((acc, c) => acc + c.committed, 0)
    const released = list.reduce((acc, c) => acc + c.released, 0)
    setTotalCommitted(committed)
    setTotalReleased(released)
  }

  const handleRequestRelease = async (projectId: string) => {
    alert("Simulated: Manual release request dispatched to cohort operator.")
  }

  const handleApproveMilestone = async (projectId: string, milestoneId: string, amountStr: string) => {
    if (!accreditedVerified) {
      alert("Accreditation self-certification is required. Please certify your status in your Profile first.")
      return
    }
    setApprovingId(milestoneId)
    const numericAmount = parseInt(amountStr.replace(/[^0-9]/g, "")) || 0

    // 1. Try to post to backend API
    try {
      // Find the investment ID that corresponds to this milestone's project.
      const targetRow = portfolio.find(p => p.id === projectId) ?? portfolio[0]
      if (!targetRow) throw new Error("No portfolio investment found")

      await apiClient.post(`/investor/portfolio/${targetRow.id}/release`, {
        amount: numericAmount
      })
    } catch (err) {
      console.warn("Release API call failed, falling back to local update only:", err)
    }

    // 2. Perform the frontend local projects-store update so the UI syncs instantly
    const { getProjectById, updateProject } = require("@/lib/projects-store")
    const proj = getProjectById(projectId)
    if (proj) {
      // Update milestones in the project
      const updatedMilestones = proj.milestones.map((m: any) => {
        if (m.id === milestoneId) {
          return {
            ...m,
            status: "Released" as const,
            releasedDate: new Date().toISOString().split("T")[0]
          }
        }
        return m
      })

      // Increase released funds in the project
      const newReleased = Math.min(proj.investmentNeeded, proj.fundsGained + numericAmount)
      updateProject(projectId, { 
        milestones: updatedMilestones,
        fundsGained: newReleased,
        trustPoints: Math.min(100, proj.trustPoints + 3)
      })
    }

    // Update investor portfolio local storage
    const updatedPortfolio = portfolio.map(p => {
      if (p.id === projectId) {
        const newReleased = Math.min(p.committed, p.released + numericAmount)
        return {
          ...p,
          released: newReleased,
          trustPoints: Math.min(100, p.trustPoints + 3)
        }
      }
      return p
    })
    setPortfolio(updatedPortfolio)
    localStorage.setItem("investor_portfolio", JSON.stringify(updatedPortfolio))
    calculateSums(updatedPortfolio)

    setApprovingId(null)
    window.dispatchEvent(new CustomEvent("founder-milestones-updated"))
    window.dispatchEvent(new CustomEvent("global-projects-updated"))
  }

  const unallocated = Math.max(0, totalCommitted - totalReleased)

  const [cohort, setCohort] = useState<{ pledged: number; count: number; announcements: number; list: any[] }>({
    pledged: 0,
    count: 0,
    announcements: 0,
    list: []
  })

  const loadCohortStats = async () => {
    try {
      const { getCohortStats } = require("@/lib/community-api")
      const stats = await getCohortStats(portfolio)
      setCohort(stats)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (portfolio.length > 0) {
      loadCohortStats()
    }
  }, [portfolio])

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="flex gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin h-6 w-6 text-foreground/40" />
            </div>
          </div>
          <ConciergeRail />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10">
      <div className="flex gap-10 sm:gap-12">
        {/* Main */}
        <div className="min-w-0 flex-1 space-y-8">

          {/* Page header */}
          <div className="space-y-1 pt-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-accent)" }} />
              Investment Center
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground leading-tight">
              {activeTab === "portfolio" ? "My Investments" : "Community Traction"}
            </h1>
            <p className="text-sm text-muted-foreground font-sans max-w-lg mt-1">
              {activeTab === "portfolio"
                ? "Allocate capital escrow pools, check milestone disbursements, and review founder evidence."
                : "Monitor builder-to-builder social proof, community pledge metrics, and active validation updates."}
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-6 border-b border-border/10 pb-1">
            <button
              onClick={() => setActiveTab("portfolio")}
              className={cn(
                "text-xs font-semibold font-mono uppercase tracking-wider pb-3 border-b-2 px-1 transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === "portfolio"
                  ? "border-amber-400 text-amber-400 font-bold"
                  : "border-transparent text-foreground/40 hover:text-foreground"
              )}
            >
              <Lock className="h-3.5 w-3.5" /> Investor Portfolio & Escrows (USD)
            </button>
            <button
              onClick={() => setActiveTab("community")}
              className={cn(
                "text-xs font-semibold font-mono uppercase tracking-wider pb-3 border-b-2 px-1 transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === "community"
                  ? "border-emerald-400 text-emerald-400 font-bold"
                  : "border-transparent text-foreground/40 hover:text-foreground"
              )}
            >
              <Coins className="h-3.5 w-3.5" /> Community Pledges Pool (INR)
            </button>
          </div>

          {/* Dynamic Tab Contents */}
          {activeTab === "portfolio" ? (
            <div className="space-y-12 animate-fade-in">
              {/* Summary strip */}
              <div className="grid gap-px sm:grid-cols-3 border border-border/10 rounded-xl overflow-hidden bg-accent/10">
                <Metric label="Escrow Committed"  value={`$${totalCommitted.toLocaleString()}`} />
                <Metric label="Capital Released"   value={`$${totalReleased.toLocaleString()}`} />
                <Metric label="Remaining Escrow" value={`$${unallocated.toLocaleString()}`} />
              </div>

              {/* ── Pending Milestone Verifications Section ── */}
              {pendingMilestonesList.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.02] p-5 space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="h-4.5 w-4.5" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider font-mono">Milestone Releases Pending Approval</h3>
                  </div>

                  {!accreditedVerified && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-500 font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <strong>Accreditation Certification Required:</strong> You must certify your investor accreditation status in your profile before you can release escrow pool disbursements.
                      </div>
                      <Button asChild size="sm" className="bg-amber-500 text-black hover:bg-amber-400 font-semibold h-8 rounded-lg shrink-0 w-full sm:w-auto">
                        <Link href="/investor/profile">Go to Profile</Link>
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-4">
                    {pendingMilestonesList.map((m) => (
                      <div key={m.id} className="rounded-lg border border-border bg-background p-4 flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold font-mono text-foreground bg-accent px-2 py-0.5 rounded">{m.projectName}</span>
                            <h4 className="text-xs font-bold text-foreground">{m.title}</h4>
                            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-400 bg-amber-500/5">
                              {m.amount} Payout Requested
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed font-sans">{m.description}</p>
                          
                          {m.workSummary && (
                            <div className="rounded border border-border/60 bg-accent/20 p-2.5">
                              <span className="text-[10px] font-bold uppercase font-mono text-foreground/50 block mb-1">Founder Work Summary:</span>
                              <p className="text-[11px] text-foreground/80 leading-relaxed font-sans">{m.workSummary}</p>
                            </div>
                          )}

                          {m.proofLink && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-muted-foreground font-mono text-[10px]">Verification Link:</span>
                              <a
                                href={m.proofLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--brand-accent)] hover:underline text-[11px] font-semibold"
                              >
                                {m.proofLink}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start shrink-0">
                          <Button
                            size="sm"
                            disabled={approvingId === m.id}
                            onClick={() => handleApproveMilestone(m.projectId, m.id, m.amount)}
                            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-semibold cursor-pointer w-full md:w-auto h-8 px-3"
                          >
                            {approvingId === m.id ? (
                              <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Verifying…
                              </>
                            ) : (
                              <>
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                                Approve & Release
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Portfolio List */}
              <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
                {portfolio.length === 0 ? (
                  <div className="px-6 py-16 text-center text-muted-foreground font-mono text-sm flex flex-col items-center justify-center gap-3">
                    <span>No investments found in your active portfolio.</span>
                    <Button asChild size="sm" className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold cursor-pointer">
                      <Link href="/investor/search">Browse Startup Cohorts</Link>
                    </Button>
                  </div>
                ) : (
                  portfolio.map((p, idx) => {
                    const pct = pctClamp((p.released / p.committed) * 100)
                    const delta = p.trustPoints - BASELINE
                    const deltaStr = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`

                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "px-5 py-5 hover:bg-accent/20 transition-colors",
                          idx !== 0 && "border-t border-border/60",
                        )}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-foreground">{p.name}</span>
                              <Badge variant="secondary" className="bg-accent text-foreground/70 border-border text-[10px] font-mono">
                                {p.stage}
                              </Badge>
                              <span className="text-xs text-muted-foreground">&middot; {p.location}</span>
                              <span className="text-sm text-foreground/70">
                                Trust <span className="font-semibold text-foreground">{p.trustPoints}</span>
                                <span className={cn("ml-1 text-xs", delta > 0 ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-muted-foreground")}>
                                  ({deltaStr})
                                </span>
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{p.next}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button asChild size="sm" className="h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold cursor-pointer">
                              <Link href={`/investor/search/${p.id}`}>View brief</Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-border/60 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent text-xs font-semibold cursor-pointer"
                              onClick={() => handleRequestRelease(p.id)}
                            >
                              Request release
                            </Button>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                              <span className="font-mono uppercase tracking-wider">Released / Committed</span>
                              <span className="font-mono">{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-border overflow-hidden">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, background: "var(--brand-accent)" }}
                                aria-label="Funding progress"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <SmallStat label="Committed" value={`$${p.committed.toLocaleString()}`} />
                            <SmallStat label="Released"  value={`$${p.released.toLocaleString()}`} />
                            <SmallStat label="Perf"      value={p.perf} />
                          </div>
                        </div>

                        {/* Founders */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Founders</span>
                          {p.founders.map((f) => (
                            <FounderDialog key={f.id} founder={f} />
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-fade-in">
              {/* Community stats strip */}
              <div className="grid gap-px sm:grid-cols-3 border border-border/10 rounded-xl overflow-hidden bg-accent/10">
                <Metric label="Total Community Pledges" value={`₹${cohort.pledged.toLocaleString()}`} />
                <Metric label="Active Pledges Count"     value={`${cohort.count} Backers`} />
                <Metric label="Validation Announcements" value={`${cohort.announcements} Updates`} />
              </div>

              {/* Portfolio Community campaigns list */}
              <div className="space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider font-mono text-foreground/45 border-b border-border/5 pb-2">
                  Portfolio Campaigns & Social Validation
                </h3>
                <div className="grid gap-6">
                  {cohort.list.map((cp: any) => {
                    const progressVal = Math.round(((cp.communityRaised || 0) / (cp.communityTarget || 25000)) * 100)
                    return (
                      <div key={cp.id} className="rounded-xl border border-border/40 bg-background p-6 space-y-6">
                        {/* Title and stats */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-semibold text-foreground">{cp.name}</h4>
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                                ₹{(cp.communityRaised || 0).toLocaleString()} raised
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground mt-0.5 block">{cp.authorHeadline} &middot; {cp.location}</span>
                          </div>
                          <div className="text-xs text-right">
                            <span className="font-mono text-foreground/40 block">Goal: ₹{(cp.communityTarget || 25000).toLocaleString()}</span>
                            <span className="font-bold text-emerald-400 font-mono text-xs">{progressVal}% Supported</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <Progress value={Math.min(100, progressVal)} className="h-2 bg-foreground/5" />
                        </div>

                        <div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-border/5">
                          {/* Left: list of backers/pledges */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/35 block">Recent Cohort Pledges</span>
                            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                              {cp.pledges && cp.pledges.length > 0 ? (
                                cp.pledges.map((pl: any) => (
                                  <div key={pl.id} className="rounded-lg border border-border/60 bg-accent/5 p-2.5 flex justify-between items-start gap-4">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-semibold text-foreground/80">{pl.founderName}</span>
                                        <span className="text-[9px] font-mono text-foreground/35">{pl.date}</span>
                                      </div>
                                      {pl.note && <p className="text-[11px] text-foreground/50 leading-relaxed font-sans mt-0.5">{pl.note}</p>}
                                    </div>
                                    <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">+₹{pl.amount.toLocaleString()}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[11px] text-foreground/35 font-mono italic">No pledges received yet.</p>
                              )}
                            </div>
                          </div>

                          {/* Right: Validation Updates Posted */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/35 block">Validation & Telemetry Stream</span>
                            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                              {cp.communityUpdates && cp.communityUpdates.length > 0 ? (
                                cp.communityUpdates.map((upd: any) => (
                                  <div key={upd.id} className="rounded-lg border border-emerald-500/10 bg-emerald-500/[0.01] p-3 space-y-1">
                                    <div className="flex justify-between items-center gap-2">
                                      <span className="text-xs font-semibold text-foreground/90">{upd.title}</span>
                                      <span className="text-[9px] font-mono text-foreground/35">{upd.date}</span>
                                    </div>
                                    <p className="text-[11px] text-foreground/50 leading-relaxed font-sans">{upd.content}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[11px] text-foreground/35 font-mono italic">No announcements posted yet.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {cohort.list.length === 0 && (
                    <div className="text-xs text-foreground/30 text-center py-16 border border-dashed border-border/5 rounded-xl bg-foreground/[0.002]">
                      No active portfolio companies to track. Commit funds to start monitoring community traction.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Concierge rail */}
        <ConciergeRail />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/10 backdrop-blur-xl p-6 group hover:bg-card/15 transition-colors">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
      <div className="text-2xl font-serif font-light text-foreground tracking-tight">{value}</div>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-accent/20 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-foreground">{value}</div>
    </div>
  )
}

function pctClamp(n: number) {
  const p = Math.round(n)
  return Math.max(0, Math.min(100, p))
}