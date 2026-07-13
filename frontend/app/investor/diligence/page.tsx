"use client"

import { useState, useEffect, useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit, ShieldAlert, ShieldCheck, HelpCircle,
  FileSearch, Scale, AlertTriangle, ArrowRight, Play, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import apiClient from "@/lib/axios"

interface AuditLogStep {
  label: string
  status: "pending" | "running" | "done"
}

interface DiligenceResult {
  projectName: string
  verdict: "proceed" | "monitor" | "caution"
  convictionScore: number // Something AI score (1-100)
  riskScore: number // Nothing AI score (1-100)
  buildViability: number // telemetry
  somethingReport: string
  nothingReport: string
  escrowRecommendation: string
}

const PROJECTS_PRESET: { id: string; name: string; desc: string }[] = []

export default function DiligencePage() {
  const [projects, setProjects] = useState<{ id: string; name: string; desc: string }[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [customDescription, setCustomDescription] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [auditLogs, setAuditLogs] = useState<string[]>([])
  const [result, setResult] = useState<DiligenceResult | null>(null)
  const [accentKey, setAccentKey] = useState("emerald")

  const logEndRef = useRef<HTMLDivElement>(null)

  // Fetch real ideas from API on mount
  useEffect(() => {
    apiClient.get<any[]>("/ideas/discover")
      .then((res) => {
        const mapped = res.data.map((raw: any) => ({
          id: raw._id ?? raw.id,
          name: raw.title ?? "Untitled",
          desc: raw.description ?? raw.desc ?? "",
        }))
        setProjects(mapped)
        if (mapped.length > 0) setSelectedProjectId(mapped[0].id)
      })
      .catch(() => setProjects([]))
  }, [])

  const SIMULATION_STEPS = [
    "Establishing secure link to Nothing & Something AI cores...",
    "Querying milestone telemetry data from distributed nodes...",
    "Running conviction probability model (Something AI)...",
    "Running burn rate & risk profile stress-test (Nothing AI)...",
    "Cross-matching patent registries and founder identity trees...",
    "Synthesizing Diligence Verdict and Escrow Release proposal..."
  ]

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("founder_settings_accent")
      if (saved) setAccentKey(saved)
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [auditLogs, currentStepIdx])

  const runDiligence = async () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setResult(null)
    setAuditLogs([])
    setCurrentStepIdx(0)

    // Stream the audit log steps while the API call is in flight
    let step = 0
    const interval = setInterval(() => {
      if (step < SIMULATION_STEPS.length) {
        setAuditLogs(prev => [...prev, `[LOG] ${SIMULATION_STEPS[step]}`])
        setCurrentStepIdx(step)
        step++
      } else {
        clearInterval(interval)
      }
    }, 900)

    try {
      const isCustom = selectedProjectId === "custom"
      const payload = isCustom
        ? { description: customDescription }
        : { ideaId: selectedProjectId }

      const res = await apiClient.post<DiligenceResult>("/investor/diligence", payload)
      clearInterval(interval)
      setResult(res.data)
    } catch (err) {
      clearInterval(interval)
      setAuditLogs(prev => [...prev, "[ERROR] Diligence request failed. Please try again."])
    } finally {
      setIsAnalyzing(false)
    }
  }

  const activeColorClass = {
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    indigo: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
    violet: "text-violet-400 border-violet-500/20 bg-violet-500/5",
    amber: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  }[accentKey] || "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12">
      
      {/* Header */}
      <div className="space-y-1.5 pb-2">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          Stealth Diligence Panel
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground leading-tight">
          Diligence AI
        </h1>
        <p className="text-sm text-muted-foreground font-sans max-w-lg mt-1">
          Perform high-fidelity automated audits using Something & Nothing AI cores to evaluate startup briefs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 items-start">
        
        {/* Left Side — Inputs */}
        <div className="lg:col-span-5 space-y-8">
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                  Select Project from Dealflow
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProjectId(p.id); setCustomDescription("") }}
                      className={cn(
                        "w-full text-left p-3.5 rounded-xl border text-xs transition-all cursor-pointer relative",
                        selectedProjectId === p.id
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/5 text-foreground font-medium"
                          : "border-border/60 text-foreground/60 hover:bg-accent/40"
                      )}
                    >
                      <div className="font-semibold text-sm mb-1">{p.name}</div>
                      <div className="line-clamp-2 text-muted-foreground text-[11px] leading-relaxed">{p.desc}</div>
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <p className="text-xs text-muted-foreground font-mono text-center py-4">No ideas found in dealflow.</p>
                  )}
                  <button
                    onClick={() => setSelectedProjectId("custom")}
                    className={cn(
                      "w-full text-left p-3.5 rounded-xl border text-xs transition-all cursor-pointer relative",
                      selectedProjectId === "custom"
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/5 text-foreground font-medium"
                        : "border-border/60 text-foreground/60 hover:bg-accent/40"
                    )}
                  >
                    <div className="font-semibold text-sm mb-1">Custom Target Description</div>
                    <div className="text-muted-foreground text-[11px]">Input a startup brief manually for audit.</div>
                  </button>
                </div>
              </div>

              {selectedProjectId === "custom" && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Brief/Description
                  </label>
                  <Textarea
                    placeholder="Enter project specifications, technology stacks, milestone timelines, or pitch summaries..."
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    className="min-h-[140px] bg-accent/20 border-border text-xs leading-relaxed"
                  />
                </div>
              )}

              <Button
                onClick={runDiligence}
                disabled={isAnalyzing || (selectedProjectId === "custom" && !customDescription.trim())}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold py-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing Project...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Run Diligence Simulation</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Audit Terminal Log (always active when runs) */}
          {(isAnalyzing || auditLogs.length > 0) && (
            <Card className="bg-[#0b0c10]/90 border-border/10 rounded-xl overflow-hidden font-mono text-[11px] text-zinc-400">
              <div className="bg-[#12131a] px-4 py-2 border-b border-border/5 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">Telemetry Live Feed</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="p-4 space-y-2.5 max-h-[200px] overflow-y-auto min-h-[120px]">
                {auditLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-zinc-600">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                    <span className={idx === currentStepIdx ? "text-emerald-400" : "text-zinc-300"}>{log}</span>
                  </div>
                ))}
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-amber-500 animate-pulse">
                    <span>&gt;&gt; Analyzing stack data...</span>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
            </Card>
          )}
        </div>

        {/* Right Side — Results Panel */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* Core Verdict Badge */}
                <Card className={cn("border bg-background/25 backdrop-blur-xl", 
                  result.verdict === "proceed" ? "border-emerald-500/20" : result.verdict === "monitor" ? "border-amber-500/20" : "border-rose-500/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">Diligence verdict</p>
                        <h2 className="text-xl font-serif font-light text-foreground">{result.projectName}</h2>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {result.verdict === "proceed" && (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" /> PROCEED TO ESCROW
                          </Badge>
                        )}
                        {result.verdict === "monitor" && (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" /> MONITOR CLOSELY
                          </Badge>
                        )}
                        {result.verdict === "caution" && (
                          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5" /> CAUTION REQUIRED
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Separator className="my-6 bg-border/5" />

                    {/* Performance Dials */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-foreground/[0.01] border border-border/5 rounded-xl p-3.5">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Conviction</div>
                        <div className="text-2xl font-serif font-light text-emerald-400">{result.convictionScore}%</div>
                      </div>
                      <div className="bg-foreground/[0.01] border border-border/5 rounded-xl p-3.5">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Friction/Risk</div>
                        <div className="text-2xl font-serif font-light text-rose-400">{result.riskScore}%</div>
                      </div>
                      <div className="bg-foreground/[0.01] border border-border/5 rounded-xl p-3.5">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Build Telemetry</div>
                        <div className="text-2xl font-serif font-light text-blue-400">{result.buildViability}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Something AI vs Nothing AI analysis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Something AI Analysis */}
                  <Card className="bg-background/25 border-emerald-500/15 backdrop-blur-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-emerald-400">S</span>
                        </div>
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">Something AI Audit</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-sans font-light">
                        {result.somethingReport}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Nothing AI Analysis */}
                  <Card className="bg-background/25 border-rose-500/15 backdrop-blur-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-5 w-5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-rose-400">N</span>
                        </div>
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">Nothing AI Audit</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-sans font-light">
                        {result.nothingReport}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Escrow release recommendation */}
                <Card className="bg-background/25 border-border/[0.03] backdrop-blur-xl">
                  <CardContent className="p-6">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground/80 mb-3 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-amber-500" /> Escrow Allocation Proposal
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed font-sans font-light">
                      {result.escrowRecommendation}
                    </p>
                  </CardContent>
                </Card>

              </motion.div>
            ) : (
              <div className="h-full min-h-[360px] border border-dashed border-border/60 rounded-xl bg-foreground/[0.005] flex flex-col items-center justify-center text-center p-8">
                <BrainCircuit className="h-10 w-10 text-muted-foreground/35 mb-4" />
                <h3 className="text-sm font-semibold text-foreground/75 mb-1.5">No Diligence Audit Generated</h3>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  Select a startup from the left, or type a description to run due diligence analysis..
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  )
}
