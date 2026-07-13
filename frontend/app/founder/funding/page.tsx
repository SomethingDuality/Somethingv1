"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import apiClient from "@/lib/axios"

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

export default function FounderFundingPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("")
  const [proofLink, setProofLink] = useState("")
  const [workSummary, setWorkSummary] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Calculate Request Payout progress
  const isProofLinkValid = (proofLink.startsWith("http://") || proofLink.startsWith("https://")) && proofLink.includes(".")
  const progressPercent = selectedMilestoneId
    ? (40 + (isProofLinkValid ? 30 : 0) + (workSummary.trim().length >= 10 ? 30 : 0))
    : 0

  // Fetch milestones from API on mount
  useEffect(() => {
    setIsLoading(true)
    apiClient.get<Milestone[]>("/founder/milestones")
      .then((res) => setMilestones(res.data))
      .catch(() => {
        // Fall back to locally cached milestones only (no seeding mock data)
        const saved = localStorage.getItem("founder_milestones")
        if (saved) {
          try { setMilestones(JSON.parse(saved)) } catch { setMilestones([]) }
        } else {
          setMilestones([])
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Sync milestones to localStorage for offline resilience
  const saveMilestones = (updated: Milestone[]) => {
    setMilestones(updated)
    localStorage.setItem("founder_milestones", JSON.stringify(updated))
  }

  // Calculate statistics from real milestone data
  const totalFunding = milestones.reduce((acc, m) => acc + parseInt(m.amount.replace(/[^0-9]/g, "") || "0"), 0)
  const releasedAmount = milestones
    .filter((m) => m.status === "Released")
    .reduce((acc, curr) => acc + parseInt(curr.amount.replace(/[^0-9]/g, "")), 0)
  const pendingAmount = milestones
    .filter((m) => m.status === "Pending Verification")
    .reduce((acc, curr) => acc + parseInt(curr.amount.replace(/[^0-9]/g, "")), 0)
  const lockedAmount = totalFunding - releasedAmount - pendingAmount

  // Find milestones that can request payout (Active status)
  const payoutEligibleMilestones = milestones.filter((m) => m.status === "Active")

  // Handle request payout submission — calls real API
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMilestoneId || !proofLink.trim() || !workSummary.trim()) {
      alert("Please fill in all fields")
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post(`/founder/milestones/${selectedMilestoneId}/submit`, {
        proofLink,
        workSummary,
      })
      // Refresh milestones from API
      const res = await apiClient.get<Milestone[]>("/founder/milestones")
      saveMilestones(res.data)
    } catch {
      // Optimistically update local state if API unavailable
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
    } finally {
      setSubmitting(false)
      setIsOpen(false)
      setSelectedMilestoneId("")
      setProofLink("")
      setWorkSummary("")
    }
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12">
      {/* Sleek inline header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-serif font-light text-foreground leading-tight">Funding Escrow Pool</h2>
          <p className="text-foreground/40 text-xs font-sans font-light leading-relaxed">Track secured community funding locked in escrow and request milestone payouts.</p>
        </div>
        <div className="flex items-center gap-2">
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
                {/* Scrollable Form Container */}
                <div className="flex-1 overflow-y-auto p-6 pr-4 space-y-5 max-h-[60vh] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                  
                  {/* Side-by-Side Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Left Column: Milestone Selector */}
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
                        {payoutEligibleMilestones.length === 0 && (
                          <div className="text-xs text-foreground/30 text-center py-8 border border-dashed border-border/5 rounded-xl bg-foreground/[0.002]">
                            No milestones eligible for verification/payout.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Inputs */}
                    <div className="space-y-4">
                      {/* Verifiable Proof Link with Live Validation */}
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
                              {isProofLinkValid ? (
                                <>
                                  <Check className="h-2.5 w-2.5" /> Valid URL Format
                                </>
                              ) : (
                                "Incomplete URL"
                              )}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
                          <Input
                            placeholder="e.g. https://github.com/something/release or https://alpha.site"
                            value={proofLink}
                            onChange={(e) => setProofLink(e.target.value)}
                            className={cn(
                              "bg-background/40 border-border/5 text-foreground placeholder:text-foreground/20 rounded-lg text-xs h-9 pl-9 transition-all duration-300",
                              isProofLinkValid
                                ? "focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/30 border-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.03)]" 
                                : "focus-visible:ring-white/10 focus-visible:border-border/20"
                            )}
                            required
                          />
                        </div>
                      </div>

                      {/* Summary of Deliverables */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Summary of Deliverables *</label>
                          <span className="text-[11px] font-mono text-foreground/30">{workSummary.length}/500</span>
                        </div>
                        <Textarea
                          maxLength={500}
                          placeholder="Detail the exact deliverables and code milestones accomplished..."
                          value={workSummary}
                          onChange={(e) => setWorkSummary(e.target.value)}
                          className={cn(
                            "min-h-[140px] bg-background/40 border-border/5 text-foreground placeholder:text-foreground/20 rounded-lg text-xs leading-relaxed transition-all duration-300",
                            workSummary.trim().length >= 10 
                              ? "focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/30 border-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.03)]" 
                              : "focus-visible:ring-white/10 focus-visible:border-border/20"
                          )}
                          required
                        />
                      </div>
                    </div>

                  </div>

                </div>

                {/* Fixed Actions Footer */}
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
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3" /> Submit Request
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Escrow Pool Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-y border-border/5">
        {/* Total Pool */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Total Pool Target</span>
          <div className="text-2xl sm:text-3xl font-serif font-light text-foreground">
            ${totalFunding.toLocaleString()}
          </div>
          <p className="text-[11px] font-mono text-foreground/35">100% of target</p>
        </div>

        {/* Released */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Released to Date</span>
          <div className="text-2xl sm:text-3xl font-serif font-light text-brand-accent">
            ${releasedAmount.toLocaleString()}
          </div>
          <p className="text-[11px] font-mono text-foreground/35">
            {totalFunding > 0 ? ((releasedAmount / totalFunding) * 100).toFixed(0) : "0"}% Disbursed
          </p>
        </div>

        {/* Pending Verification */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Pending Release</span>
          <div className="text-2xl sm:text-3xl font-serif font-light text-[#C88E72]">
            ${pendingAmount.toLocaleString()}
          </div>
          <p className="text-[11px] font-mono text-foreground/35">Awaiting committee</p>
        </div>

        {/* Locked in Escrow */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/35">Locked in Escrow</span>
          <div className="text-2xl sm:text-3xl font-serif font-light text-foreground/70">
            ${lockedAmount.toLocaleString()}
          </div>
          <p className="text-[11px] font-mono text-foreground/35">Matures upcoming</p>
        </div>
      </div>

      {/* Escrow Pool Progress Bar */}
      <div className="py-4 space-y-3">
        <div className="flex justify-between items-center text-[11px] font-mono font-bold tracking-widest uppercase text-foreground/40">
          <span>Escrow Release Progress</span>
          <span className="text-foreground/70 text-xs font-semibold font-sans">
            ${releasedAmount.toLocaleString()} / ${totalFunding.toLocaleString()} Released
          </span>
        </div>
        <Progress value={totalFunding > 0 ? (releasedAmount / totalFunding) * 100 : 0} className="h-2 bg-foreground/5" />
        <div className="flex items-center justify-between text-[11px] text-foreground/30 pt-0.5 font-mono tracking-wider">
          <span>START</span>
          <span className="text-brand-accent font-semibold">{totalFunding > 0 ? ((releasedAmount / totalFunding) * 100).toFixed(1) : "0.0"}% SECURED RELEASED</span>
          <span>GOAL</span>
        </div>
      </div>

      {/* Milestones Road Map and Timelines */}
      <div className="grid gap-10 sm:gap-12 lg:grid-cols-3">
        {/* Timeline Grid */}
        <div className="lg:col-span-2 space-y-8">
          <div className="border-b border-border/5 pb-3">
            <h3 className="text-sm font-semibold tracking-widest uppercase text-foreground/45 font-mono">Milestone Timeline</h3>
          </div>
          <div className="space-y-12 relative pt-2">
            {/* Center connector line */}
            <div className="absolute left-[15px] top-6 bottom-6 w-[1px] bg-foreground/[0.03] pointer-events-none" />

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
              </div>
            ) : milestones.length === 0 ? (
              <div className="py-16 text-center text-xs text-foreground/30 font-mono uppercase tracking-widest">
                No milestones found.
              </div>
            ) : (
              milestones.map((m) => {
              const isReleased = m.status === "Released"
              const isPending = m.status === "Pending Verification"
              const isActive = m.status === "Active"

              return (
                <div key={m.id} className="relative flex items-start gap-4 sm:gap-6 group">
                  {/* Status Indicator Bubble */}
                  <div
                    className={cn(
                      "relative z-10 size-8 rounded-full grid place-items-center border transition-all duration-300 bg-background",
                      isReleased
                        ? "border-brand-accent/30 text-brand-accent"
                        : isPending
                          ? "border-[#C88E72]/30 text-[#C88E72] animate-pulse"
                          : isActive
                            ? "border-brand-accent/30 text-brand-accent"
                            : "border-border/5 text-foreground/20"
                    )}
                  >
                    {isReleased ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isPending ? (
                      <Clock className="h-3.5 w-3.5" />
                    ) : isActive ? (
                      <span className="size-1.5 rounded-full bg-brand-accent" />
                    ) : (
                      <Lock className="h-3 w-3" />
                    )}
                  </div>

                  {/* Milestone details (cardless) */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3
                        className={cn(
                          "font-semibold text-base leading-snug transition-colors",
                          isReleased ? "text-brand-accent" : isPending ? "text-[#C88E72]" : "text-foreground"
                        )}
                      >
                        {m.title}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold text-foreground/50">{m.amount}</span>
                        <Badge
                          className={cn(
                            "text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border",
                            isReleased
                              ? "bg-brand-accent/10 text-brand-accent border-brand-accent/20"
                              : isPending
                                ? "bg-[#C88E72]/10 text-[#C88E72] border-[#C88E72]/20"
                                : isActive
                                  ? "bg-foreground/5 text-foreground/70 border-border/10"
                                  : "bg-foreground/5 text-foreground/40 border-border/10"
                          )}
                        >
                          {m.status === "Pending Verification" ? "Pending" : m.status}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-sm text-foreground/60 leading-relaxed font-sans">{m.description}</p>

                    {/* Submissions & Deliverables logs */}
                    {(isReleased || isPending) && (
                      <div className="space-y-2.5 text-xs pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-foreground/40 font-mono text-[11px] tracking-wide">
                          <span>
                            {isReleased ? "APPROVED & DISBURSED" : "SUBMITTED FOR VALIDATION"}
                          </span>
                          <span>
                            DATE: {isReleased ? m.releasedDate : m.submittedDate}
                          </span>
                        </div>
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
                              <Link href="/founder/chats">
                                Inquire Payout Status
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
            )}
          </div>
        </div>

        {/* Security & Validation details */}
        <div className="space-y-12">
          {/* Validation Committee */}
          <div className="space-y-4">
            <div className="border-b border-border/5 pb-3">
              <h3 className="text-sm font-semibold tracking-widest uppercase text-foreground/45 font-mono">Validation Committee</h3>
            </div>
            <div className="space-y-4 pt-2">
              <div className="pt-4 flex gap-2 text-xs text-foreground/50 bg-foreground/[0.01] rounded-xl p-3.5 border border-border/5 leading-relaxed font-sans">
                <ShieldCheck className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                <p>
                  Validation requires approval from at least <strong>50%</strong> of active review board members. Review is typically completed within 72 hours.
                </p>
              </div>
            </div>
          </div>

          {/* Escrow Guidelines */}
          <div className="space-y-4">
            <div className="border-b border-border/5 pb-3">
              <h3 className="text-sm font-semibold tracking-widest uppercase text-foreground/45 font-mono">Escrow Guidelines</h3>
            </div>
            <div className="space-y-4 pt-2 text-xs text-foreground/50 leading-relaxed font-sans">
              <p>
                1. Escrow pool funds are secured by smart contract and can only be disbursed to the verified project treasury after committee validation.
              </p>
              <p>
                2. Submitting milestone verification requires compiling proof documents (GitHub repository tag releases, test suites, or live deployments).
              </p>
              <p>
                3. If milestone deliverables require changes, reviewers will attach a feedback log detailing code reviews or functional gaps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}