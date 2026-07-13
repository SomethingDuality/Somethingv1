"use client"

import { useState, useEffect } from "react"
import apiClient from "@/lib/axios"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  TrendingUp, ArrowUpRight, ArrowRight,
  Loader2, AlertTriangle, PenLine, CheckCircle2, Clock, Lock,
  Coins, Lightbulb, Users, MessageSquare, Info, X, HelpCircle
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { OnboardingModal } from "@/components/onboarding-modal"

// ─── Types ────────────────────────────────────────────────────────────────────
interface KpiData { ideas: number; teamMembers: number; fundsRaised: string; unreadChats: number }
interface Idea { id: string; title: string; status: "Funded" | "Seeking" | "Draft"; funding: string; stage: string; tags: string[]; fundedPct: number }
interface TeamMember { id: string; initials: string; name: string; role: string; lastActive: string }
interface ActivityItem { id: string; text: string; timestamp: string; important?: boolean }
interface OverviewData { kpis: KpiData; ideas: Idea[]; team: TeamMember[]; activity: ActivityItem[]; escrow: { raised: number; goal: number } }

// ─── API ─────────────────────────────────────────────────────────────────────
const overviewAPI = {
  async getOverviewData(): Promise<OverviewData> {
    try {
      const r = await apiClient.get<OverviewData>("/founder/overview")
      return r.data
    } catch {
      return {
        kpis: { ideas: 0, teamMembers: 0, fundsRaised: '$0', unreadChats: 0 },
        ideas: [],
        team: [],
        activity: [],
        escrow: { raised: 0, goal: 0 },
      }
    }
  },
}

// ─── Count-up ─────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    let cur = 0
    const inc = target / 36
    const t = setInterval(() => {
      cur += inc
      if (cur >= target) { setCount(target); clearInterval(t) }
      else setCount(Math.floor(cur))
    }, duration / 36)
    return () => clearInterval(t)
  }, [target, duration])
  return count
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FounderOverviewPage() {
  const [data, setData]       = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [greeting, setGreeting] = useState("")
  const [dateStr, setDateStr]   = useState("")

  // Onboarding
  const [onboardingPlan, setOnboardingPlan] = useState("something")
  const [onboardingName, setOnboardingName] = useState("Founder")

  // Interactive help banners
  const [showWorkspaceGuide, setShowWorkspaceGuide] = useState(true)
  const [showEscrowHelp, setShowEscrowHelp] = useState(false)
  const [showIdeasHelp, setShowIdeasHelp] = useState(false)
  const [showLeaderboardHelp, setShowLeaderboardHelp] = useState(false)
  const [showTeamHelp, setShowTeamHelp] = useState(false)
  const [showActivityHelp, setShowActivityHelp] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOnboardingPlan(localStorage.getItem("selected_plan") || "something")
      setOnboardingName(localStorage.getItem("demo_name") || "Founder")
      const dismissed = localStorage.getItem("workspace_guide_dismissed")
      if (dismissed === "true") {
        setShowWorkspaceGuide(false)
      }
    }
  }, [])

  useEffect(() => {
    const d = new Date()
    const h = d.getHours()
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening")
    setDateStr(d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }))
    overviewAPI.getOverviewData()
      .then(setData)
      .catch(() => setError("Could not load overview."))
      .finally(() => setLoading(false))
  }, [])

  const dismissGuide = () => {
    setShowWorkspaceGuide(false)
    if (typeof window !== "undefined") {
      localStorage.setItem("workspace_guide_dismissed", "true")
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
    </div>
  )
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
      <AlertTriangle className="h-6 w-6 text-foreground/20" />
      <p className="text-foreground/35 text-xs">{error}</p>
    </div>
  )

  const { kpis, ideas, team, activity, escrow } = data
  const escrowPct = Math.round((escrow.raised / escrow.goal) * 100)
  const fundsRaw  = parseInt(kpis.fundsRaised.replace(/[^0-9]/g, "")) || 0

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12">
      {/* Onboarding modal — only shows once for new signups */}
      <OnboardingModal role="founder" plan={onboardingPlan} userName={onboardingName} />

      <PageHeader
        category={`${greeting} — ${dateStr}`}
        title="Workspace Overview"
        description="Review milestone disbursements, coordinate cohort ideas, and track builder synchronization."
        accentColor="amber"
        action={
          <div className="flex gap-2.5">
            <Button asChild size="sm" className="h-8.5 rounded-full bg-foreground text-background hover:bg-foreground/90 hover:scale-[1.01] transition-all duration-300 font-semibold text-xs px-4.5 cursor-pointer" style={{ fontFamily: "var(--font-outfit)" }}>
              <Link href="/founder/ideas" className="flex items-center gap-1.5"><PenLine className="h-3.5 w-3.5" />New idea</Link>
            </Button>
            <Button asChild size="sm" className="h-8.5 rounded-full bg-foreground/[0.02] border border-border/10 text-foreground/70 hover:text-foreground hover:bg-foreground/5 hover:border-border/20 transition-all duration-300 font-semibold text-xs px-4.5 cursor-pointer" style={{ fontFamily: "var(--font-outfit)" }}>
              <Link href="/founder/funding" className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Milestones</Link>
            </Button>
          </div>
        }
      />

      {/* ── Collapsible Workspace Guide Banner ── */}
      {showWorkspaceGuide && (
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-foreground/[0.01] p-6 mb-8 transition-all duration-300 animate-fade-in">
          <div className="absolute top-4 right-4">
            <button
              onClick={dismissGuide}
              className="text-foreground/40 hover:text-foreground/80 transition-colors p-1.5 rounded-full hover:bg-foreground/5 cursor-pointer"
              title="Dismiss Guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-brand-accent/10 border border-brand-accent/20 shrink-0 text-brand-accent mt-0.5">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-4 pr-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground tracking-wide" style={{ fontFamily: "var(--font-outfit)" }}>
                  Workspace Navigation Guide
                </h3>
                <p className="text-xs text-foreground/50 leading-relaxed mt-1">
                  Welcome to the Workspace! Here is a brief explanation of how cohort collaboration and milestone-based funding flow:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-brand-accent font-semibold">1. Submission & Tags</div>
                  <p className="text-[11px] text-foreground/45 leading-relaxed">
                    Submit project proposals under <Link href="/founder/ideas" className="underline hover:text-foreground">Ideas</Link>. Tag them with relevant domains to coordinate reviews.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-500/80 font-semibold">2. Cohort Upvotes</div>
                  <p className="text-[11px] text-foreground/45 leading-relaxed">
                    Ideas gain backing from the cohort community. Ranks are synced real-time based on upvote conviction weights.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-500/80 font-semibold">3. Milestone Payouts</div>
                  <p className="text-[11px] text-foreground/45 leading-relaxed">
                     escrow disbursements are released as you complete each phase. Submit proof requirements to verify and unlock funds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert banner — only shown when API returns pending milestones ── */}
      {data.activity.some(a => a.important) && (
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-[#C88E72]/[0.02] py-4 px-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C88E72] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C88E72]"></span>
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#C88E72] font-semibold">Verification Alert</span>
            </div>
            <p className="flex-1 text-[12.5px] text-foreground/60 leading-relaxed font-sans">
              {data.activity.find(a => a.important)?.text}
            </p>
            <Link href="/founder/funding" className="shrink-0 text-xs font-medium text-[#C88E72] hover:text-[#C88E72]/85 transition-colors flex items-center gap-1 self-start sm:self-auto group font-sans">
              View funding <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      )}

      {/* ── KPI Stats Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        <KpiStatCard label="Funds raised" rawValue={fundsRaw} isCurrency sub={kpis.fundsRaised !== "$0" ? "This funding cycle" : "No funds yet"} icon={Coins} />
        <KpiStatCard label="Active ideas" rawValue={kpis.ideas} sub={kpis.ideas === 1 ? "1 in progress" : `${kpis.ideas} in progress`} icon={Lightbulb} />
        <KpiStatCard label="Team members" rawValue={kpis.teamMembers} sub={kpis.teamMembers > 0 ? "All active" : "No members yet"} icon={Users} />
        <KpiStatCard label="Unread chats" rawValue={kpis.unreadChats} sub={kpis.unreadChats > 0 ? `${kpis.unreadChats} unread` : "All caught up"} icon={MessageSquare} />
      </div>

      {/* ── Grid Layout with Breathing Space ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 xl:gap-14">

        {/* ── Left column (3/5): Escrow + Ideas ── */}
        <div className="lg:col-span-3 space-y-10">

          {/* Milestone Escrow Pool Card */}
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-8 hover:border-border/30 hover:bg-card/15 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="flex items-start justify-between gap-4 border-b border-border/5 pb-4 mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <SectionLabel>Milestone Escrow Pool</SectionLabel>
                  <button
                    onClick={() => setShowEscrowHelp(!showEscrowHelp)}
                    className="text-foreground/30 hover:text-foreground/60 p-0.5 rounded-full transition-colors cursor-pointer"
                    title="What is this?"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-foreground/45">Funds held in secure multi-signature escrow.</p>
              </div>
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="text-xs text-foreground/35">Released</span>
                <span className="text-2xl font-serif font-light text-[#C88E72]">{escrowPct}%</span>
              </div>
            </div>

            {/* Escrow Help Sub-banner */}
            {showEscrowHelp && (
              <div className="p-3.5 mb-5 text-[11px] text-foreground/50 leading-relaxed bg-foreground/[0.02] border border-border/10 rounded-xl animate-slide-down">
                The milestone escrow pool locks project investments in smart contracts. Payouts are triggered sequentially as verification criteria are uploaded and verified by the cohort validators.
              </div>
            )}

            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-3xl font-serif font-light tracking-tight text-foreground">
                ${escrow.raised.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-foreground/30">/ ${escrow.goal.toLocaleString()} total</span>
            </div>

            <div className="h-1 w-full bg-foreground/[0.04] rounded-full overflow-hidden mb-6 relative">
              <div
                className="h-full bg-brand-accent/70 transition-all duration-1000"
                style={{ width: `${escrowPct}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {[
                { label: "Whitepaper & Specs",    amount: "$40K", done: true,  pending: false },
                { label: "Alpha & Sync Engine",   amount: "$40K", done: false, pending: true  },
                { label: "Security Audit & Beta", amount: "$40K", done: false, pending: false },
                { label: "Mainnet Launch",        amount: "$80K", done: false, pending: false },
              ].map((m, i) => (
                <div key={i} className="space-y-3.5 py-5 px-4.5 rounded-xl border border-border/[0.03] hover:border-border/[0.08] hover:bg-foreground/[0.015] transition-all">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[10px] font-mono font-semibold",
                      m.done ? "text-foreground/75" : m.pending ? "text-[#C88E72]" : "text-foreground/18"
                    )}>{m.amount}</span>
                    <div className={cn(
                      "size-4 rounded-full border grid place-items-center",
                      m.done ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent" :
                      m.pending ? "bg-[#C88E72]/10 border-[#C88E72]/30 text-[#C88E72] animate-pulse" :
                      "bg-foreground/[0.01] border-border/10 text-foreground/10"
                    )}>
                      {m.done    ? <CheckCircle2 className="h-2.5 w-2.5" />
                       : m.pending ? <Clock className="h-2.5 w-2.5" />
                       : <Lock className="h-2.5 w-2.5" />}
                    </div>
                  </div>
                  <div>
                    <p className={cn("text-[11px] font-semibold leading-snug",
                      m.done ? "text-foreground/80" : m.pending ? "text-foreground/60" : "text-foreground/25"
                    )}>{m.label}</p>
                    <p className={cn("text-[8px] font-mono uppercase tracking-[0.12em] mt-1.5",
                      m.done ? "text-brand-accent/70" : m.pending ? "text-[#C88E72]/70" : "text-foreground/18"
                    )}>
                      {m.done ? "Released" : m.pending ? "Pending" : "Locked"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Your Ideas Card */}
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-8 hover:border-border/30 hover:bg-card/15 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="flex items-start justify-between border-b border-border/5 pb-4 mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <SectionLabel>Your ideas</SectionLabel>
                  <button
                    onClick={() => setShowIdeasHelp(!showIdeasHelp)}
                    className="text-foreground/30 hover:text-foreground/60 p-0.5 rounded-full transition-colors cursor-pointer"
                    title="What is this?"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-foreground/45">Submission status and funding tracking.</p>
              </div>
              <Link href="/founder/ideas" className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand-accent hover:text-brand-accent/75 transition-colors flex items-center gap-1 font-semibold">
                All ideas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Ideas Help Sub-banner */}
            {showIdeasHelp && (
              <div className="p-3.5 mb-5 text-[11px] text-foreground/50 leading-relaxed bg-foreground/[0.02] border border-border/10 rounded-xl animate-slide-down">
                Review, draft, and post workspace project concepts. Once concept requirements are complete, submit them to switch their status from Draft to Seeking for cohort backing.
              </div>
            )}

            <div className="divide-y divide-border/5">
              {ideas.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column (2/5): Team + Activity ── */}
        <div className="lg:col-span-2 space-y-8">

          {/* Cohort Leaderboard Card */}
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-8 hover:border-border/30 hover:bg-card/15 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="border-b border-border/5 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <SectionLabel>Cohort Leaderboard</SectionLabel>
                <button
                  onClick={() => setShowLeaderboardHelp(!showLeaderboardHelp)}
                  className="text-foreground/30 hover:text-foreground/60 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="What is this?"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-foreground/45 mt-1 font-sans">Top projects by upvote conviction.</p>
            </div>

            {showLeaderboardHelp && (
              <div className="p-3 mb-4 text-[11px] text-foreground/50 leading-relaxed bg-foreground/[0.02] border border-border/10 rounded-xl animate-slide-down">
                Community voting weights measure the conviction of cohort participants. The leaderboard ranks the most backed ideas, which receive funding release priority.
              </div>
            )}

            <div className="space-y-3">
              <div className="text-[11px] text-foreground/30 font-mono uppercase tracking-wider py-8 text-center">No submissions yet</div>
            </div>
          </div>

          {/* Team Sync Card */}
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-8 hover:border-border/30 hover:bg-card/15 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="border-b border-border/5 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <SectionLabel>Team synchronization</SectionLabel>
                <button
                  onClick={() => setShowTeamHelp(!showTeamHelp)}
                  className="text-foreground/30 hover:text-foreground/60 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="What is this?"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-foreground/45 mt-1 font-sans">Real-time presence and active roles.</p>
            </div>

            {showTeamHelp && (
              <div className="p-3 mb-4 text-[11px] text-foreground/50 leading-relaxed bg-foreground/[0.02] border border-border/10 rounded-xl animate-slide-down">
                Real-time active status of build partners linked to this workspace repo. Shows active sync status of members and roles.
              </div>
            )}

            <div className="space-y-1.5">
              {team.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-foreground/[0.02] transition-all cursor-default border border-transparent hover:border-border/5">
                  <div className="h-7.5 w-7.5 rounded-full bg-foreground/[0.04] border border-border/10 text-foreground/60 text-[9px] font-bold grid place-items-center shrink-0 font-mono">
                    {m.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-foreground/85 truncate">{m.name}</div>
                    <div className="text-[9px] text-foreground/35 font-mono mt-0.5 uppercase tracking-wide truncate">{m.role}</div>
                  </div>
                  <span className="text-[9px] font-mono text-foreground/25 shrink-0 tabular-nums">{m.lastActive}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-8 hover:border-border/30 hover:bg-card/15 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="border-b border-border/5 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <SectionLabel>Recent activity</SectionLabel>
                <button
                  onClick={() => setShowActivityHelp(!showActivityHelp)}
                  className="text-foreground/30 hover:text-foreground/60 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="What is this?"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-foreground/45 mt-1 font-sans">System updates and interactions.</p>
            </div>

            {showActivityHelp && (
              <div className="p-3 mb-4 text-[11px] text-foreground/50 leading-relaxed bg-foreground/[0.02] border border-border/10 rounded-xl animate-slide-down">
                A rolling feed tracking key system-level transactions, milestone verification updates, and team changes.
              </div>
            )}

            <div className="space-y-1.5">
              {activity.map((item) => {
                const getActivityHref = (text: string) => {
                  const lower = text.toLowerCase()
                  if (lower.includes("message") || lower.includes("sent")) return "/founder/chats"
                  if (lower.includes("payout") || lower.includes("released") || lower.includes("funding")) return "/founder/funding"
                  if (lower.includes("edge vision")) return "/founder/ideas"
                  if (lower.includes("local‑first") || lower.includes("local-first")) return "/founder/ideas"
                  return "/founder/ideas"
                }
                return (
                  <Link
                    key={item.id}
                    href={getActivityHref(item.text)}
                    className="flex items-start gap-3 py-3 px-2.5 rounded-xl hover:bg-foreground/[0.02] transition-all cursor-pointer block border border-transparent hover:border-border/5"
                  >
                    <span className={cn(
                      "mt-[6px] h-1.5 w-1.5 rounded-full shrink-0",
                      item.important ? "bg-[#C88E72]" : "bg-foreground/12"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[11.5px] leading-relaxed", item.important ? "text-foreground/80 font-medium" : "text-foreground/45 hover:text-foreground/75")}>
                        {item.text}
                      </p>
                      <span className="text-[8px] font-mono text-foreground/25 uppercase tracking-wider mt-1 block">{item.timestamp}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}

// ─── Shared Components ─────────────────────────────────────────────────────────
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[9px] font-mono uppercase tracking-[0.2em] text-foreground/40", className)}>
      {children}
    </p>
  )
}

function KpiStatCard({ label, rawValue, isCurrency, sub, icon: Icon }: {
  label: string; rawValue: number; isCurrency?: boolean; sub: string; icon: any
}) {
  const count   = useCountUp(rawValue)
  const display = isCurrency ? `$${count.toLocaleString()}` : count.toString()
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl hover:bg-card/15 hover:border-border/40 transition-all duration-300 p-6 cursor-default shadow-sm hover:shadow-md">
      <div className="flex justify-between items-center">
        <span className="text-xs text-foreground/45 font-sans font-light tracking-wide">{label}</span>
        <Icon className="h-4 w-4 text-foreground/30 group-hover:text-brand-accent transition-colors duration-300" />
      </div>
      <div className="text-3xl font-serif font-light text-foreground/95 mt-3 tracking-tight group-hover:scale-[1.01] duration-300 origin-left transition-transform">
        {display}
      </div>
      <div className="text-[10px] text-foreground/30 font-sans font-light mt-2">{sub}</div>
    </div>
  )
}

function IdeaRow({ idea }: { idea: Idea }) {
  const s = {
    Funded:  { text: "text-brand-accent", bg: "bg-brand-accent/5", border: "border-brand-accent/10" },
    Seeking: { text: "text-[#C88E72]",  bg: "bg-[#C88E72]/5",  border: "border-[#C88E72]/10" },
    Draft:   { text: "text-foreground/30",  bg: "bg-foreground/[0.01]",  border: "border-border/5" },
  }[idea.status]

  return (
    <div className="group relative py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:px-2 rounded-lg -mx-2 hover:bg-foreground/[0.01]">
      <div className="flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground/80 group-hover:text-brand-accent transition-colors duration-300">
            {idea.title}
          </span>
          <Badge className={cn("text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 border rounded-full shrink-0", s.text, s.bg, s.border)}>
            {idea.status}
          </Badge>
          <span className="text-[9px] font-mono text-foreground/35 uppercase tracking-widest bg-foreground/[0.03] border border-border/5 px-2 py-0.5 rounded">{idea.stage}</span>
        </div>
        
        {/* Tags */}
        <div className="flex gap-1.5 flex-wrap">
          {idea.tags.map((tag) => (
            <span key={tag} className="text-[9px] font-mono text-foreground/30 bg-foreground/[0.01] border border-border/[0.03] rounded px-1.5 py-0.5">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Funding Progress */}
      <div className="w-full md:w-48 space-y-1.5 shrink-0">
        <div className="flex justify-between text-[9px] font-mono text-foreground/35">
          <span>{idea.funding}</span>
          <span className="font-semibold">{idea.fundedPct}%</span>
        </div>
        <div className="h-0.5 w-full rounded-full bg-foreground/[0.03] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700",
              idea.fundedPct === 100 ? "bg-brand-accent" : "bg-foreground/20"
            )}
            style={{ width: `${idea.fundedPct}%` }}
          />
        </div>
      </div>

      {/* Link button */}
      <Link href={`/founder/ideas/${idea.id}`}
        className="shrink-0 text-[10px] font-semibold text-foreground/60 hover:text-foreground transition-colors flex items-center gap-1 align-middle justify-center py-1.5 px-3 border border-border/10 hover:border-border/20 rounded-lg bg-transparent">
        Explore <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </Link>
    </div>
  )
}
