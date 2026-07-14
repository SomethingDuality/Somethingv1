"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Lock,
  Coins,
  Clock,
  Check,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Send,
  Loader2,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types
type MilestoneStatus = "Released" | "Pending Verification" | "Active" | "Locked"

interface Milestone {
  id: string
  title: string
  amount: string
  status: MilestoneStatus
  description: string
  submittedDate?: string
  releasedDate?: string
  proofLink?: string
  workSummary?: string
}

// Initial Mock Milestones
const INITIAL_MILESTONES: Milestone[] = [
  {
    id: "m1",
    title: "Milestone 1: Whitepaper & Architecture Specs",
    amount: "$40,000",
    status: "Released",
    description: "Publish the core decentralization design draft, API specs, and system engineering schemas.",
    releasedDate: "2026-05-15",
    proofLink: "https://github.com/something/docs/whitepaper.md",
    workSummary: "Finalized whitepaper specs and local-first architecture details with team and advisory board approval.",
  },
  {
    id: "m2",
    title: "Milestone 2: Alpha Application & Sync Engine",
    amount: "$40,000",
    status: "Pending Verification",
    description: "Launch prototype workspace featuring local-first SQLite nodes syncing peer-to-peer.",
    submittedDate: "2026-06-18",
    proofLink: "https://alpha.something.dev",
    workSummary: "Sync engine prototype is live. Tested peer synchronization with 5 concurrent active nodes.",
  },
  {
    id: "m3",
    title: "Milestone 3: Security Audit & Public Beta",
    amount: "$40,000",
    status: "Active",
    description: "Conduct smart contract security audits, launch public landing sandbox, onboard 100 beta testing founders.",
  },
  {
    id: "m4",
    title: "Milestone 4: Mainnet Launch & Public APIs",
    amount: "$80,000",
    status: "Locked",
    description: "Deploy stable production release on decentralized nodes and publish public developer documentation.",
  },
]

export default function FounderFundingPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("")
  const [proofLink, setProofLink] = useState("")
  const [workSummary, setWorkSummary] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [activeProject, setActiveProject] = useState<any>(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"investor" | "community">("investor")

  // Community Updates form states
  const [communityTitle, setCommunityTitle] = useState("")
  const [communityContent, setCommunityContent] = useState("")
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

  const [pledgesList, setPledgesList] = useState<any[]>([])
  const [communityUpdates, setCommunityUpdates] = useState<any[]>([])
  const [communityRaised, setCommunityRaised] = useState(0)
  const [communityTarget, setCommunityTarget] = useState(25000)

  const isProofLinkValid = (proofLink.startsWith("http://") || proofLink.startsWith("https://")) && proofLink.includes(".")
  const progressPercent = selectedMilestoneId
    ? (40 + (isProofLinkValid ? 30 : 0) + (workSummary.trim().length >= 10 ? 30 : 0))
    : 0

  const loadCommunityData = async (projId: string) => {
    try {
      const { getCommunityStats } = require("@/lib/community-api")
      const stats = await getCommunityStats(projId)
      setPledgesList(stats.pledges)
      setCommunityUpdates(stats.communityUpdates)
      setCommunityRaised(stats.communityRaised)
      setCommunityTarget(stats.communityTarget)
    } catch (e) {
      console.error(e)
    }
  }

  // Load from local storage or set defaults
  useEffect(() => {
    if (typeof window !== "undefined") {
      const { getProjects } = require("@/lib/projects-store")
      const list = getProjects()
      const active = list.find((p: any) => p.author === "You") || list[0]
      setActiveProject(active)
      if (active) {
        setMilestones(active.milestones || [])
        loadCommunityData(active.id)
      }
    }
  }, [])

  useEffect(() => {
    const handleUpdate = () => {
      if (activeProject) {
        loadCommunityData(activeProject.id)
      }
    }
    window.addEventListener("global-projects-updated", handleUpdate)
    return () => {
      window.removeEventListener("global-projects-updated", handleUpdate)
    }
  }, [activeProject])

  // Save to local storage
  const saveMilestones = (updated: Milestone[]) => {
    setMilestones(updated)
    if (activeProject) {
      const { updateProject } = require("@/lib/projects-store")
      const updatedProj = updateProject(activeProject.id, { milestones: updated })
      if (updatedProj) {
        setActiveProject(updatedProj)
      }
      // Dispatch storage event to alert investor side
      window.dispatchEvent(new CustomEvent("founder-milestones-updated"))
      window.dispatchEvent(new CustomEvent("global-projects-updated"))
    }
  }

  // Calculate statistics
  const totalFunding = milestones.reduce((acc, curr) => acc + (parseInt(curr.amount.replace(/[^0-9]/g, "")) || 0), 0) || 200000
  const releasedAmount = milestones
    .filter((m) => m.status === "Released")
    .reduce((acc, curr) => acc + (parseInt(curr.amount.replace(/[^0-9]/g, "")) || 0), 0)
  const pendingAmount = milestones
    .filter((m) => m.status === "Pending Verification")
    .reduce((acc, curr) => acc + (parseInt(curr.amount.replace(/[^0-9]/g, "")) || 0), 0)
  const lockedAmount = totalFunding - releasedAmount - pendingAmount

  // Find milestones that can request payout (Active status)
  const payoutEligibleMilestones = milestones.filter((m) => m.status === "Active")

  // Handle request payout submission
  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMilestoneId || !proofLink.trim() || !workSummary.trim()) {
      alert("Please fill in all fields")
      return
    }

    setSubmitting(true)

    // Simulate network submission delay
    setTimeout(() => {
      const updated = milestones.map((m) => {
        if (m.id === selectedMilestoneId) {
          return {
            ...m,
            status: "Pending Verification" as const,
            submittedDate: new Date().toISOString().split("T")[0],
            proofLink,
            workSummary,
          }
        }
        return m
      })

      saveMilestones(updated)
      setSubmitting(false)
      setIsOpen(false)
      // Reset form
      setSelectedMilestoneId("")
      setProofLink("")
      setWorkSummary("")
    }, 1200)
  }

  // Handle community update announcements
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject || !communityTitle.trim() || !communityContent.trim()) return

    setPostingAnnouncement(true)
    try {
      const { postCommunityAnnouncement } = require("@/lib/community-api")
      const result = await postCommunityAnnouncement(activeProject.id, communityTitle, communityContent)
      if (result.success) {
        setCommunityTitle("")
        setCommunityContent("")
        alert("Validation update published to community backers!")
        window.dispatchEvent(new CustomEvent("global-projects-updated"))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPostingAnnouncement(false)
    }
  }


  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/5">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-serif font-light text-foreground leading-tight">
            {activeTab === "investor" ? "Milestone Escrow Pipeline" : "Community Pledges Pool"}
          </h2>
          <p className="text-foreground/40 text-xs font-sans font-light leading-relaxed">
            {activeTab === "investor" 
              ? "Track secured institutional VC funding locked in milestone escrows."
              : "Track micro-backings pledged in INR by builder community members."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "investor" && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  disabled={payoutEligibleMilestones.length === 0}
                  className="rounded-xl text-xs font-semibold px-4 py-2 bg-foreground text-background hover:bg-brand-accent hover:text-background transition-all duration-300 disabled:opacity-40 disabled:hover:bg-foreground active:scale-[0.98] cursor-pointer h-9"
                >
                  <PlusCircle className="mr-1.5 h-4 w-4 text-inherit" /> Request Payout
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-popover/95 backdrop-blur-2xl border border-border/[0.08] text-foreground rounded-2xl sm:max-w-3xl shadow-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
                
                {/* Top Form Progress Bar */}
                <div className="w-full h-[3px] bg-foreground/[0.03]">
                  <div 
                    className="h-full bg-brand-accent transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <DialogHeader className="p-6 pb-4 border-b border-border/[0.05] shrink-0">
                  <DialogTitle className="text-xl font-serif font-light text-foreground flex items-center gap-2">
                    <Coins className="h-5 w-5 text-brand-accent" />
                    Request Milestone Payout
                  </DialogTitle>
                  <DialogDescription className="text-foreground/40 text-xs mt-1">
                    Provide verifiable completion proof. Investors will review the inputs and release escrow funds.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleRequestPayout} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 pr-4 space-y-5 max-h-[60vh] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono block">Select Active Milestone *</label>
                        <div className="grid gap-2.5 max-h-[300px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                          {payoutEligibleMilestones.map((m) => {
                            const selected = selectedMilestoneId === m.id
                            return (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => setSelectedMilestoneId(m.id)}
                                className={cn(
                                  "flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-300 group cursor-pointer w-full relative overflow-hidden",
                                  selected
                                    ? "bg-brand-accent/10 border-brand-accent/40"
                                    : "bg-background/30 border-border/5 hover:bg-foreground/[0.02] hover:border-border/10"
                                )}
                              >
                                <div className="flex items-center justify-between w-full mb-1">
                                  <span className="text-[11px] text-brand-accent font-semibold tracking-wider font-mono uppercase bg-brand-accent/10 border border-brand-accent/20 px-2 py-0.5 rounded-full">
                                    {m.title.split(":")[0]}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-foreground">{m.amount}</span>
                                    {selected && (
                                      <div className="p-0.5 rounded-full bg-brand-accent/20 border border-brand-accent/30 text-brand-accent">
                                        <Check className="h-3 w-3 animate-scale-in" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <h4 className={cn(
                                  "text-xs font-bold mt-1.5 leading-snug transition-colors",
                                  selected ? "text-foreground" : "text-foreground/80"
                                )}>
                                  {m.title.split(":")[1]?.trim() || m.title}
                                </h4>
                                <p className="text-[11px] text-foreground/40 mt-1 leading-normal font-sans">
                                  {m.description}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Verifiable Proof Link *</label>
                            {proofLink.trim() && (
                              <span className={cn(
                                "text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1",
                                isProofLinkValid
                                  ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                                  : "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                              )}>
                                {isProofLinkValid ? <Check className="h-2.5 w-2.5" /> : null}
                                {isProofLinkValid ? "Valid Format" : "Incomplete URL"}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
                            <Input
                              placeholder="e.g. https://github.com/something/release"
                              value={proofLink}
                              onChange={(e) => setProofLink(e.target.value)}
                              className={cn(
                                "bg-background/40 border-border/5 text-foreground placeholder:text-foreground/20 rounded-lg text-xs h-9 pl-9 focus-visible:ring-emerald-500/20"
                              )}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Summary of Deliverables *</label>
                          <Textarea
                            placeholder="Detail deliverables accomplished..."
                            value={workSummary}
                            onChange={(e) => setWorkSummary(e.target.value)}
                            className="min-h-[140px] bg-background/40 border-border/5 text-foreground text-xs"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end p-6 border-t border-border/[0.05] bg-background/40 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                      className="border-border/10 text-foreground hover:bg-foreground/5 text-xs font-semibold rounded-lg h-9 px-4 bg-transparent cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting || !selectedMilestoneId || !proofLink.trim() || !workSummary.trim()}
                      className="bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold h-9 px-5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3 w-3" />}
                      {submitting ? "Submitting..." : "Submit Request"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {activeTab === "investor" && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Reset milestones to initial demo data?")) {
                  saveMilestones(INITIAL_MILESTONES)
                }
              }}
              className="border border-border/10 text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-xl text-xs h-9 px-4 font-semibold bg-transparent cursor-pointer"
            >
              Reset Demo Data
            </Button>
          )}
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-6 border-b border-border/10 pb-1">
        <button
          onClick={() => setActiveTab("investor")}
          className={cn(
            "text-xs font-semibold font-mono uppercase tracking-wider pb-3 border-b-2 px-1 transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "investor"
              ? "border-amber-400 text-amber-400 font-bold"
              : "border-transparent text-foreground/40 hover:text-foreground"
          )}
        >
          <Lock className="h-3.5 w-3.5" /> Investor Escrow Pipeline (USD)
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
      {activeTab === "investor" ? (
        <div className="space-y-12 animate-fade-in">
          {/* Explanation Grid */}
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400">
              <Coins className="h-4 w-4" />
              <h4 className="text-xs font-semibold font-mono uppercase tracking-wider">Investor Escrow Pipeline</h4>
            </div>
            <p className="text-xs text-foreground/75 leading-relaxed font-sans font-light">
              These funds are committed in USD ($) by institutional VCs. Payouts are locked in smart escrows and released only when you submit completion proof for each milestone.
            </p>
            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 pt-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              Requires Investor review & approval. You can also DM VCs to align on deliverables.
            </div>
          </div>

          {/* Escrow Pool Balance Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-y border-border/5">
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Total Pool Target</span>
              <div className="text-2xl sm:text-3xl font-serif font-light text-foreground">${totalFunding.toLocaleString()}</div>
              <p className="text-[11px] font-mono text-foreground/35">100% of target</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Released to Date</span>
              <div className="text-2xl sm:text-3xl font-serif font-light text-brand-accent">${releasedAmount.toLocaleString()}</div>
              <p className="text-[11px] font-mono text-foreground/35">{((releasedAmount / totalFunding) * 100).toFixed(0)}% Disbursed</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Pending Release</span>
              <div className="text-2xl sm:text-3xl font-serif font-light text-[#C88E72]">${pendingAmount.toLocaleString()}</div>
              <p className="text-[11px] font-mono text-foreground/35">Awaiting committee</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Locked in Escrow</span>
              <div className="text-2xl sm:text-3xl font-serif font-light text-foreground/70">${lockedAmount.toLocaleString()}</div>
              <p className="text-[11px] font-mono text-foreground/35">Matures upcoming</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="py-4 space-y-3">
            <div className="flex justify-between items-center text-[11px] font-mono font-bold tracking-widest uppercase text-foreground/40">
              <span>Escrow Release Progress</span>
              <span className="text-foreground/77 text-xs font-semibold font-sans">
                ${releasedAmount.toLocaleString()} / ${totalFunding.toLocaleString()} Released
              </span>
            </div>
            <Progress value={(releasedAmount / totalFunding) * 100} className="h-2 bg-foreground/5" />
            <div className="flex items-center justify-between text-[11px] text-foreground/30 pt-0.5 font-mono tracking-wider">
              <span>START</span>
              <span className="text-brand-accent font-semibold">{((releasedAmount / totalFunding) * 100).toFixed(1)}% SECURED RELEASED</span>
              <span>GOAL</span>
            </div>
          </div>

          {/* Timeline and Validation Committee */}
          <div className="grid gap-10 sm:gap-12 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              <div className="border-b border-border/5 pb-3">
                <h3 className="text-sm font-semibold tracking-widest uppercase text-foreground/45 font-mono">Milestone Timeline</h3>
              </div>
              <div className="space-y-12 relative pt-2">
                <div className="absolute left-[15px] top-6 bottom-6 w-[1px] bg-foreground/[0.03] pointer-events-none" />
                {milestones.map((m) => {
                  const isReleased = m.status === "Released"
                  const isPending = m.status === "Pending Verification"
                  const isActive = m.status === "Active"

                  return (
                    <div key={m.id} className="relative flex items-start gap-4 sm:gap-6 group">
                      <div className={cn(
                        "size-8 rounded-full border grid place-items-center shrink-0 z-10 font-mono text-xs font-bold transition-all duration-300",
                        isReleased && "bg-brand-accent border-brand-accent text-background shadow-[0_0_15px_rgba(227,194,122,0.15)]",
                        isPending && "bg-background border-[#C88E72] text-[#C88E72] animate-pulse",
                        isActive && "bg-background border-foreground text-foreground shadow-[0_0_10px_rgba(255,255,255,0.05)]",
                        m.status === "Locked" && "bg-background border-border/5 text-foreground/15"
                      )}>
                        {isReleased ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : <span>{m.id.replace("m", "")}</span>}
                      </div>

                      <div className="flex-1 space-y-3 pt-0.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={cn("text-sm font-bold tracking-tight", isReleased ? "text-foreground/90" : "text-foreground")}>
                                {m.title.split(":")[1]?.trim() || m.title}
                              </h4>
                              <Badge className={cn(
                                "text-[10px] font-mono uppercase tracking-wider font-semibold border px-2 py-0.5 rounded-full",
                                isReleased && "bg-brand-accent/10 border-brand-accent/20 text-brand-accent",
                                isPending && "bg-[#C88E72]/10 border-[#C88E72]/20 text-[#C88E72]",
                                isActive && "bg-foreground/5 border-foreground/10 text-foreground/80",
                                m.status === "Locked" && "bg-background border-border/5 text-foreground/20"
                              )}>
                                {m.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-foreground/40 font-mono tracking-wider">Disbursement: {m.amount}</p>
                          </div>
                        </div>

                        {isActive && (
                          <p className="text-xs text-foreground/60 leading-relaxed max-w-xl font-sans font-light">
                            {m.description}
                          </p>
                        )}

                        {m.releasedDate && (
                          <div className="text-[11px] font-mono text-foreground/35 flex items-center gap-1.5">
                            <span className="inline-block h-1 w-1 rounded-full bg-brand-accent" />
                            Released on {m.releasedDate}
                          </div>
                        )}
                        {m.submittedDate && (
                          <div className="text-[11px] font-mono text-[#C88E72] flex items-center gap-1.5">
                            <span className="inline-block h-1 w-1 rounded-full bg-[#C88E72]" />
                            Submitted for approval on {m.submittedDate}
                          </div>
                        )}

                        {m.workSummary && (
                          <div className="bg-foreground/[0.01] border border-border/[0.03] rounded-lg p-3 text-foreground/70 text-xs italic leading-relaxed">
                            &ldquo;{m.workSummary}&rdquo;
                          </div>
                        )}

                        {m.proofLink && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[11px] font-mono text-foreground/35 uppercase tracking-widest">PROOF:</span>
                            <a
                              href={m.proofLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-accent hover:underline flex items-center gap-1 font-mono text-[11px] truncate"
                            >
                              {m.proofLink} <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {isPending && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10.5px] rounded-lg border-border/40 hover:bg-accent text-foreground/70 hover:text-foreground font-mono font-medium cursor-pointer"
                              asChild
                            >
                              <Link href="/founder/chats">Inquire Payout Status</Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-4">
                <div className="border-b border-border/5 pb-3">
                  <h3 className="text-sm font-semibold tracking-widest uppercase text-foreground/45 font-mono">Validation Committee</h3>
                </div>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent grid place-items-center text-xs font-semibold font-mono shadow">SC</div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">Sarah Chen</div>
                      <div className="text-[11px] text-brand-accent font-semibold tracking-wider font-mono uppercase">Lead Reviewer - Horizon Capital</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-[#F472B6]/10 border border-[#F472B6]/20 text-[#F472B6] grid place-items-center text-xs font-semibold font-mono shadow">LV</div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">Liam Vance</div>
                      <div className="text-[11px] text-[#F472B6] font-semibold tracking-wider font-mono uppercase">Reviewer - Vance Capital</div>
                    </div>
                  </div>
                  <div className="pt-4 flex gap-2 text-xs text-foreground/50 bg-foreground/[0.01] rounded-xl p-3.5 border border-border/5 leading-relaxed font-sans">
                    <ShieldCheck className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                    <p>Validation requires approval from 50% of active review board. Typically completed within 72 hours.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b border-border/5 pb-3">
                  <h3 className="text-sm font-semibold tracking-widest uppercase text-foreground/45 font-mono">Escrow Guidelines</h3>
                </div>
                <div className="space-y-4 pt-2 text-xs text-foreground/50 leading-relaxed font-sans">
                  <p>1. Escrow pool funds are secured by smart contract and can only be disbursed after committee validation.</p>
                  <p>2. Milestone verifications require compiling proof documents (releases, live deployments, test suites).</p>
                  <p>3. If deliverables require adjustments, reviewers will attach a feedback log detailingfunctional gaps.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">
          {/* Community Pledges Explanation Card */}
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <Coins className="h-4 w-4" />
              <h4 className="text-xs font-semibold font-mono uppercase tracking-wider">Community Pledges Pool</h4>
            </div>
            <p className="text-xs text-foreground/75 leading-relaxed font-sans font-light">
              These are micro-backings pledged in INR (₹) by fellow builders. Pledges represent community grants with no milestone escrow gates, available directly immediately.
            </p>
            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 pt-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              Direct-release support. Backers can pledge ₹1 to support validator metrics.
            </div>
          </div>

          {/* Community Progress Banner */}
          <Card className="relative overflow-hidden bg-background/10 border-border/[0.03] rounded-xl shadow-md p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35 block mb-1">Community Campaign Raised</span>
                <div className="text-3xl font-serif font-light text-foreground">
                  ₹{(communityRaised || 0).toLocaleString()} <span className="text-sm text-foreground/45 font-sans">pledged of ₹{(communityTarget || 25000).toLocaleString()}</span>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono px-3 py-1 rounded-full">
                {pledgesList.length} Active Pledges
              </Badge>
            </div>
            <div className="space-y-2">
              <Progress value={(communityRaised / communityTarget) * 100} className="h-2.5 bg-foreground/5" />
              <div className="flex justify-between text-[11px] font-mono text-foreground/30">
                <span>{Math.round((communityRaised / communityTarget) * 100)}% Funded</span>
                <span>Grants unlocked and fully available</span>
              </div>
            </div>
          </Card>

          {/* Split backer list & Composer */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Backers Feed */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground/45 border-b border-border/5 pb-2">Pledges Received</h3>
              <div className="space-y-4 pr-1 max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                {pledgesList.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-border/5 bg-background/25 p-4 flex justify-between items-start hover:border-border/10 transition-all duration-300">
                     <div className="space-y-2 min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground/90">{p.founderName}</span>
                        <span className="text-[10px] font-mono text-foreground/30">{p.date}</span>
                      </div>
                      {p.note && (
                        <p className="text-xs text-foreground/50 leading-relaxed font-sans font-light">{p.note}</p>
                      )}
                    </div>
                    <div className="text-sm font-bold font-mono text-emerald-400 shrink-0">
                      +₹{p.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
                {pledgesList.length === 0 && (
                  <div className="text-xs text-foreground/30 text-center py-16 border border-dashed border-border/5 rounded-xl bg-foreground/[0.002]">
                    No pledges received yet. Share your project link on the Discover feed to gain support!
                  </div>
                )}
              </div>
            </div>

            {/* Announcement composer & feed */}
            <div className="space-y-6">
              <form onSubmit={handlePostAnnouncement} className="space-y-4 bg-background/10 border border-border/5 p-5 rounded-2xl">
                <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground/50">Post Backer Update</h4>
                <div className="space-y-2.5">
                  <Input
                    placeholder="Update Title (e.g. Beta Manufacturing Order)"
                    value={communityTitle}
                    onChange={(e) => setCommunityTitle(e.target.value)}
                    className="bg-background/40 border-border/10 text-xs h-9 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/30"
                    required
                  />
                  <Textarea
                    placeholder="Share detailed progress updates or validation results directly with your community backers..."
                    value={communityContent}
                    onChange={(e) => setCommunityContent(e.target.value)}
                    className="bg-background/40 border-border/10 text-xs min-h-[120px] focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/30"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={postingAnnouncement || !communityTitle.trim() || !communityContent.trim()}
                  className="bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-semibold h-8 rounded-lg cursor-pointer px-4 w-full"
                >
                  {postingAnnouncement ? "Publishing..." : "Publish Announcement"}
                </Button>
              </form>

              {/* Previously posted updates */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/45 border-b border-border/5 pb-2">Announcements</h4>
                <div className="space-y-3.5">
                  {communityUpdates.map((u: any) => (
                    <div key={u.id} className="rounded-xl border border-border/5 bg-accent/5 p-4 space-y-2">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <h5 className="text-xs font-bold text-foreground/90">{u.title}</h5>
                        <span className="text-[10px] font-mono text-foreground/35">{u.date}</span>
                      </div>
                      <p className="text-xs text-foreground/50 leading-relaxed font-sans font-light">{u.content}</p>
                    </div>
                  ))}
                  {communityUpdates.length === 0 && (
                    <p className="text-[11px] text-foreground/30 font-mono uppercase tracking-widest text-center py-4">No updates posted yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}