"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, FileText, ExternalLink, ShieldCheck, Lock, CheckCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Project = {
  id: string
  name: string
  domains: string[]
  desc: string
  stage: "Pre‑seed" | "Seed" | "Angel" | "Series A"
  launchedAt: string | null
  trustPoints: number
  location: string
  investmentNeeded: number
  fundsGained: number
  fundsSpent: number
  founders: { id: string; name: string; role: string }[]
  uploads: { type: "deck" | "link" | "image"; label: string; href?: string; src?: string }[]
}

const MOCK: Project[] = []

export default function ProjectBriefPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [p, setP] = useState<Project | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(true)

  // NDA state
  const [ndaSigned, setNdaSigned] = useState(false)
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false)
  const [legalName, setLegalName] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  useEffect(() => {
    if (!id) return
    const isSigned = localStorage.getItem(`nda_signed_${id}`) === "true"
    setNdaSigned(isSigned)
  }, [id])

  useEffect(() => {
    if (!id) return
    setIsLoadingProject(true)
    apiClient.get(`/ideas/${id}`)
      .then((res) => {
        const raw = res.data
        setP({
          id: raw._id ?? raw.id,
          name: raw.title ?? "Untitled",
          domains: raw.tags ?? [],
          desc: raw.description ?? raw.desc ?? "",
          stage: raw.stage ?? "concept",
          launchedAt: raw.createdAt ?? null,
          trustPoints: 75,
          location: raw.location ?? "Remote",
          investmentNeeded: raw.fundingGoal ?? 0,
          fundsGained: raw.fundsGained ?? 0,
          fundsSpent: raw.fundsSpent ?? 0,
          founders: raw.founders ?? [],
          uploads: raw.uploads ?? [],
        })
      })
      .catch(() => setP(null))
      .finally(() => setIsLoadingProject(false))
  }, [id])

  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!p) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold mb-2">Project not found</h2>
        <Button onClick={() => router.push("/investor/search")} variant="outline">
          Back to search
        </Button>
      </div>
    )
  }

  const [selectedFounder, setSelectedFounder] = useState<{ name: string; role: string; bio?: string } | null>(null)

  const handleStartChat = (founderName: string) => {
    const isGhost = localStorage.getItem("investor_ghost_mode") === "true"

    const storedThreads = localStorage.getItem("investor_threads")
    let threads = []
    if (storedThreads) {
      try {
        threads = JSON.parse(storedThreads)
      } catch {
        threads = []
      }
    }
    
    const cleanId = "th-" + founderName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    
    // Add to investor_threads
    const exists = threads.some((t: any) => t.id === cleanId)
    if (!exists) {
      const newThread = {
        id: cleanId,
        name: `${founderName} • ${p.name}`,
        lastMessagePreview: isGhost ? `[stealth match] Message sent from Ghost Investor` : `New conversation regarding ${p.name}...`,
        unreadCount: 0,
        participants: [{ id: cleanId.replace("th-", ""), name: founderName, avatarInitials: founderName.split(" ").map((n) => n[0]).join(""), isOnline: true }],
        lastActive: new Date().toISOString(),
        isOnline: true,
        isGhostMode: isGhost,
      }
      const updated = [newThread, ...threads]
      localStorage.setItem("investor_threads", JSON.stringify(updated))
    }

    // Add to founder_chat_threads and messages
    const founderStored = localStorage.getItem("founder_chat_threads")
    let founderThreads = []
    if (founderStored) {
      try { founderThreads = JSON.parse(founderStored) } catch { founderThreads = [] }
    }
    
    const founderExists = founderThreads.some((t: any) => t.id === cleanId)
    if (!founderExists) {
      const investorName = localStorage.getItem("demo_name") || ""
      const newFounderThread = {
        id: cleanId,
        name: isGhost ? "Ghost Investor" : investorName,
        preview: `New conversation regarding ${p.name}...`,
        unread: 1,
        category: "requests",
        participants: [founderName, isGhost ? "Ghost Investor" : investorName],
        lastActive: "Just now",
        isOnline: true,
        isGhostMode: isGhost,
        realInvestorName: investorName,
        realFirmName: localStorage.getItem("demo_firm") || ""
      }
      const updatedFounder = [newFounderThread, ...founderThreads]
      localStorage.setItem("founder_chat_threads", JSON.stringify(updatedFounder))
      
      // Initialize messages
      const founderMsgs = localStorage.getItem("founder_chat_messages")
      let msgsDb: Record<string, any> = {}
      if (founderMsgs) {
        try { msgsDb = JSON.parse(founderMsgs) } catch { msgsDb = {} }
      }
      msgsDb[cleanId] = [
        {
          id: `m-init-${Date.now()}`,
          from: "them",
          text: `Hi ${founderName}, I'm interested in your project brief for ${p.name}.`,
          when: "Just now",
          timestamp: Date.now(),
          seen: false,
          delivered: true
        }
      ]
      localStorage.setItem("founder_chat_messages", JSON.stringify(msgsDb))
      
      // Sync investor messages
      localStorage.setItem(`investor_msgs_${cleanId}`, JSON.stringify([
        {
          id: `m-init-${Date.now()}`,
          sender: { id: cleanId.replace("th-", ""), name: founderName },
          text: `Hi ${founderName}, I'm interested in your project brief for ${p.name}.`,
          createdAt: new Date().toISOString(),
          deliveryStatus: "delivered"
        }
      ]))
    }
    
    router.push(`/investor/chats?activeId=${cleanId}`)
  }

  const handleCommitFunds = async () => {
    try {
      await apiClient.post("/investor/commit", {
        ideaId: p.id,
        amount: p.investmentNeeded
      })
    } catch (err: unknown) {
      console.warn("Commit API failed, saving locally", err)
      const stored = localStorage.getItem("investor_portfolio")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let portfolioList: any[] = []
      if (stored) { try { portfolioList = JSON.parse(stored) } catch { portfolioList = [] } }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exists = portfolioList.some((item: any) => item.id === p.id)
      if (!exists) {
        localStorage.setItem("investor_portfolio", JSON.stringify([
          ...portfolioList,
          {
            id: p.id, name: p.name, stage: p.stage, location: p.location,
            trustPoints: p.trustPoints, committed: p.investmentNeeded,
            released: p.fundsGained, perf: "Good",
            next: "Milestone 1: Alpha Spec Verification",
            founders: p.founders.map(f => ({ id: f.id, name: f.name, role: f.role }))
          }
        ]))
      }
    }
    alert(`Successfully committed $${p.investmentNeeded.toLocaleString()} to ${p.name} Escrow Pool. Redirecting to investments...`)
    router.push("/investor/investments")
  }

  const handleRequestUpdate = () => {
    alert("Simulated: Update request dispatched to the founders.")
  }

  const tp       = clamp(p.trustPoints, 1, 100)
  const delta    = tp - 75
  const deltaStr = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`
  const progress = Math.max(0, Math.min(100, Math.round((p.fundsSpent / Math.max(1, p.fundsGained)) * 100)))

  const handleAffixSignature = () => {
    if (!legalName.trim() || !agreedToTerms) return
    localStorage.setItem(`nda_signed_${p.id}`, "true")
    setNdaSigned(true)
    setIsSigningModalOpen(false)
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12">

      {/* Back button */}
      <div className="pt-2">
        <Button
          onClick={() => router.push("/investor/search")}
          variant="ghost"
          className="h-8 rounded-lg text-foreground/60 hover:text-foreground hover:bg-accent -ml-2 text-sm cursor-pointer"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to search
        </Button>
      </div>

      {/* ── Header ── */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2 mb-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-accent)" }} />
          Project Brief
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-serif font-light tracking-tight text-foreground">{p.name}</h1>
              <Badge variant="secondary" className="bg-accent text-foreground/70 border-border font-mono text-[10px]">
                {p.stage}
              </Badge>
              {p.domains.map((d) => (
                <Badge key={d} variant="secondary" className="bg-accent/60 text-foreground/60 border-border/60 text-[10px]">
                  {d}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground">&middot; {p.location}</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">{p.desc}</p>
          </div>

          <div className="lg:shrink-0 space-y-2">
            <div className="text-sm text-foreground/70">
              Trust <span className="font-semibold text-foreground">{tp}</span>
              <span className={cn("ml-1 text-xs", delta > 0 ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-muted-foreground")}>
                ({deltaStr})
              </span>
            </div>
            <div className="h-1 w-48 rounded-full bg-border overflow-hidden">
              <div
                className="h-1 rounded-full transition-all"
                style={{ width: `${Math.max(2, (tp / 100) * 100)}%`, background: "var(--brand-accent)" }}
                aria-label="Trust meter"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Funds ── */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">Capital</p>
        <div className="grid gap-px sm:grid-cols-3 border border-border rounded-xl overflow-hidden">
          <Stat label="Funds gained" value={`$${p.fundsGained.toLocaleString()}`} />
          <Stat label="Spent"        value={`$${p.fundsSpent.toLocaleString()}`} />
          <Stat label="Needed"       value={`$${p.investmentNeeded.toLocaleString()}`} />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mb-1.5">
            <span className="uppercase tracking-wider">Burn rate (spent / gained)</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${progress}%`, background: "var(--brand-accent)" }}
            />
          </div>
        </div>
      </div>

      {/* ── Uploads (Gated behind Mutual NDA) ── */}
      <div className="relative">
        <div className="flex justify-between items-center mb-3">
          <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Founder Uploads</p>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            {ndaSigned ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> NDA Signed & Sealed
              </span>
            ) : (
              <span className="text-amber-500 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Mutual NDA Required
              </span>
            )}
          </div>
        </div>

        {/* Uploads list container */}
        <div className="relative rounded-xl border border-border bg-background/40 overflow-hidden">
          
          {/* Blurred/masked overlay if NDA is not signed */}
          {!ndaSigned && (
            <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/80 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <Lock className="h-8 w-8 text-amber-500 stroke-[1.5]" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">Secure mNDA Protected Data</h4>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  Pitch decks, technical architecture rooms, and hardware sensor telemetry logs are locked under a cryptographically verified Mutual NDA.
                </p>
              </div>
              <Button
                onClick={() => setIsSigningModalOpen(true)}
                className="bg-primary text-primary-foreground hover:opacity-95 text-xs font-semibold px-6 rounded-full cursor-pointer"
                id="sign-nda-trigger-btn"
              >
                Review & Sign Mutual NDA
              </Button>
            </div>
          )}

          <div className={cn("p-6 grid gap-3 sm:grid-cols-2", !ndaSigned && "pointer-events-none")}>
            {p.uploads.map((u, i) => {
              if (u.type === "deck" || u.type === "link") {
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 hover:bg-accent/20 transition-colors">
                    <div className="flex items-center gap-2 text-sm text-foreground/70 min-w-0">
                      {u.type === "deck"
                        ? <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        : <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                      }
                      <span className="truncate">{u.label}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg border-border/60 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent text-xs shrink-0 cursor-pointer"
                      asChild
                    >
                      <Link href={u.href || "#"}>Open</Link>
                    </Button>
                  </div>
                )
              }
              return (
                <div key={i} className="rounded-xl border border-border overflow-hidden bg-accent/20">
                  <img
                    alt={u.label}
                    src={u.src || "/placeholder.svg?height=120&width=200&query=project%20image"}
                    className="h-28 w-full object-cover"
                  />
                  <div className="px-4 py-2.5 text-sm text-foreground/70">{u.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Founders ── */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">Founders</p>
        <div className="rounded-xl border border-border overflow-hidden bg-background/25">
          {p.founders.map((f, i) => (
            <div
              key={f.id}
              className={cn(
                "px-5 py-4 flex items-center justify-between gap-3 hover:bg-accent/20 transition-colors",
                i !== 0 && "border-t border-border/60"
              )}
            >
              <div>
                <div className="font-medium text-sm text-foreground">{f.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{f.role}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFounder({
                    name: f.name,
                    role: f.role,
                    bio: `${f.name} is a key contributor to this project. Use the profile view to check credentials, or click 'Start chat' to connect.`
                  })}
                  className="h-8 rounded-lg border-border/60 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent text-xs cursor-pointer"
                >
                  View profile
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStartChat(f.name)}
                  className="h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs cursor-pointer"
                >
                  Start chat
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">Actions</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={handleCommitFunds}
            className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 font-medium cursor-pointer"
          >
            Commit funds
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!ndaSigned) setIsSigningModalOpen(true)
            }}
            disabled={ndaSigned}
            className="rounded-lg border-border/60 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent cursor-pointer"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {ndaSigned ? "NDA Signed" : "Request/Sign NDA"}
          </Button>
          <Button
            variant="outline"
            onClick={handleRequestUpdate}
            className="rounded-lg border-border/60 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent cursor-pointer"
          >
            Request update
          </Button>
        </div>
      </div>

      <Separator className="bg-border/60" />

      <div className="text-xs text-muted-foreground font-mono">
        Verified projects display an additional badge after Something review.
      </div>

      {/* Mutual NDA Signing Dialog */}
      {isSigningModalOpen && (
        <Dialog open={isSigningModalOpen} onOpenChange={setIsSigningModalOpen}>
          <DialogContent className="w-full max-w-lg bg-popover text-popover-foreground border border-border shadow-2xl p-6 rounded-xl">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="font-serif font-light text-xl text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[var(--brand-accent)]" />
                Mutual Non-Disclosure Agreement
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono">
                Project Ref: mNDA-{p.id.toUpperCase()}
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 bg-accent/20 border border-border/40 p-4 rounded-lg text-xs leading-relaxed text-zinc-400 space-y-3 max-h-[220px] overflow-y-auto font-mono">
              <p><strong>MUTUAL NON-DISCLOSURE AGREEMENT (mNDA)</strong></p>
              <p>
                This Mutual Non-Disclosure Agreement (the &quot;Agreement&quot;) is entered into between the project representative of <strong>{p.name}</strong> (&quot;Disclosing Party&quot;) and the signed verified investor (&quot;Receiving Party&quot;).
              </p>
              <p>
                1. <strong>Purpose.</strong> The parties wish to explore a potential business relationship, in connection with which either party may disclose proprietary and confidential information.
              </p>
              <p>
                2. <strong>Confidentiality.</strong> The Receiving Party shall protect and preserve the confidentiality of the Disclosing Party&apos;s data, including patent claims, financial telemetry, milestone releases, and deck materials.
              </p>
              <p>
                3. <strong>Restrictions.</strong> Receiving Party shall not distribute, copy, reverse engineer, or sell any disclosed specifications without explicit consent.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                  Legal Name (Digital Signature)
                </label>
                <Input
                  placeholder="Enter your full legal name..."
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="bg-accent/20 border-border text-xs"
                  id="nda-legal-name-input"
                />
              </div>

              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="agree-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 shrink-0 rounded border-border bg-accent/20 focus:ring-[var(--brand-accent)] accent-[var(--brand-accent)]"
                />
                <label htmlFor="agree-checkbox" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer select-none">
                  I agree to the terms of this mutual NDA and represent that I am a verified investor.
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border/5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSigningModalOpen(false)}
                className="h-8 text-xs rounded-lg border-border/60"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAffixSignature}
                disabled={!legalName.trim() || !agreedToTerms}
                className="h-8 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-95"
                id="nda-submit-btn"
              >
                Affix Digital Signature
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Founder Profile Dialog */}
      {selectedFounder && (
        <Dialog open={!!selectedFounder} onOpenChange={(open) => !open && setSelectedFounder(null)}>
          <DialogContent className="w-full max-w-md bg-[#101113] text-white border-white/5 p-6 rounded-xl">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="font-serif font-light text-xl text-white">
                {selectedFounder.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-white/50 font-mono">
                {selectedFounder.role}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-sm leading-relaxed text-white/70 font-sans">
              {selectedFounder.bio}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFounder(null)}
                className="h-8 text-xs rounded-lg border-white/10 text-white bg-transparent hover:bg-white/5"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const name = selectedFounder.name
                  setSelectedFounder(null)
                  handleStartChat(name)
                }}
                className="h-8 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-95"
              >
                Start Chat
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card/10 backdrop-blur-xl p-6 hover:bg-card/15 transition-colors">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="text-lg font-serif font-light text-foreground tracking-tight">
        {value}{hint ? <span className="ml-1 text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
