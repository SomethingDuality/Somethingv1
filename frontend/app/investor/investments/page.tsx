"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { ConciergeRail } from "@/components/concierge-rail"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FounderDialog, type Founder } from "@/components/founder-dialog"
import { cn } from "@/lib/utils"
import { Check, ExternalLink, ShieldCheck, AlertCircle, RefreshCw, Loader2 } from "lucide-react"

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

export default function InvestorInvestmentsPage() {
  const [portfolio, setPortfolio] = useState<Row[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCommitted, setTotalCommitted] = useState<number>(0)
  const [totalReleased, setTotalReleased] = useState<number>(0)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  useEffect(() => {
    fetchPortfolio()
    loadMilestones()

    // Listen for custom events to keep local storage synced
    const syncHandler = () => {
      loadMilestones()
      fetchPortfolio()
    }
    window.addEventListener("founder-milestones-updated", syncHandler)
    return () => {
      window.removeEventListener("founder-milestones-updated", syncHandler)
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
      const stored = localStorage.getItem("founder_milestones")
      if (stored) {
        try {
          setMilestones(JSON.parse(stored))
        } catch {
          setMilestones([])
        }
      }
    }
  }

  const fetchPortfolio = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get<PortfolioResponse>("/investor/portfolio")
      setPortfolio(response.data.data || [])
      setTotalCommitted(response.data.totalCommitted || 0)
      setTotalReleased(response.data.totalReleased || 0)
    } catch (err) {
      console.warn("Failed to fetch API portfolio, loading from localStorage fallback:", err)
      const stored = localStorage.getItem("investor_portfolio")
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setPortfolio(parsed)
          calculateSums(parsed)
        } catch {
          setPortfolio([])
          calculateSums([])
        }
      } else {
        setPortfolio([])
        calculateSums([])
      }
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
    // This is a general release nudge — the actual per-investment release
    // is done via handleApproveMilestone which calls the correct endpoint.
    alert("To release funds, approve a pending milestone above.")
  }

  const handleApproveMilestone = async (milestoneId: string, amountStr: string) => {
    if (!accreditedVerified) {
      alert("Accreditation self-certification is required. Please certify your status in your Profile first.")
      return
    }
    setApprovingId(milestoneId)
    const numericAmount = parseInt(amountStr.replace(/[^0-9]/g, "")) || 0

    try {
      // Find the investment ID that corresponds to this milestone's project.
      // The portfolio rows have an `id` that matches the investment _id from the backend.
      // We use the first portfolio entry as the target (Edge Vision Kit = p1).
      // When a real milestone→investmentId mapping exists this can be more precise.
      const targetRow = portfolio.find(p => p.id === "p1") ?? portfolio[0]
      if (!targetRow) throw new Error("No portfolio investment found")

      await apiClient.post(`/investor/portfolio/${targetRow.id}/release`, {
        amount: numericAmount
      })

      // Update milestones in localStorage to keep the local funding page in sync
      const updatedMilestones = milestones.map(m =>
        m.id === milestoneId
          ? { ...m, status: "Released" as const, releasedDate: new Date().toISOString().split("T")[0] }
          : m
      )
      setMilestones(updatedMilestones)
      localStorage.setItem("founder_milestones", JSON.stringify(updatedMilestones))

      window.dispatchEvent(new CustomEvent("founder-milestones-updated"))
      // Refresh portfolio from server to get the updated released amount
      await fetchPortfolio()
    } catch (err) {
      console.warn("Release API call failed, falling back to local update:", err)
      // Local fallback so the UI still responds
      const updatedMilestones = milestones.map(m =>
        m.id === milestoneId
          ? { ...m, status: "Released" as const, releasedDate: new Date().toISOString().split("T")[0] }
          : m
      )
      setMilestones(updatedMilestones)
      localStorage.setItem("founder_milestones", JSON.stringify(updatedMilestones))

      const updatedPortfolio = portfolio.map(p => {
        if (p.id === "p1") {
          return { ...p, released: Math.min(p.committed, p.released + numericAmount) }
        }
        return p
      })
      setPortfolio(updatedPortfolio)
      localStorage.setItem("investor_portfolio", JSON.stringify(updatedPortfolio))
      calculateSums(updatedPortfolio)
      window.dispatchEvent(new CustomEvent("founder-milestones-updated"))
    } finally {
      setApprovingId(null)
    }
  }

  const pendingMilestones = milestones.filter(m => m.status === "Pending Verification")
  const unallocated = Math.max(0, totalCommitted - totalReleased)

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
        <div className="min-w-0 flex-1 space-y-12">

          {/* Page header */}
          <div className="space-y-1 pt-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-accent)" }} />
              Portfolio Tracker
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground leading-tight">
              My Investments
            </h1>
            <p className="text-sm text-muted-foreground font-sans max-w-lg mt-1">
              Allocate capital escrow pools, check milestone disbursements, and review founder evidence telemetry.
            </p>
          </div>

          {/* Summary strip */}
          <div className="grid gap-px sm:grid-cols-3 border border-border/10 rounded-xl overflow-hidden bg-accent/10">
            <Metric label="Escrow Committed"  value={`$${totalCommitted.toLocaleString()}`} />
            <Metric label="Capital Released"   value={`$${totalReleased.toLocaleString()}`} />
            <Metric label="Remaining Escrow" value={`$${unallocated.toLocaleString()}`} />
          </div>

          {/* ── Pending Milestone Verifications Section (Closed-Loop escrow approval) ── */}
          {pendingMilestones.length > 0 && (
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
                {pendingMilestones.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border bg-background p-4 flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold font-mono text-foreground bg-accent px-2 py-0.5 rounded">Edge Vision Kit</span>
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
                        onClick={() => handleApproveMilestone(m.id, m.amount)}
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

          {/* Portfolio list */}
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
                    {/* Top line */}
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

                    {/* Progress + numbers */}
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