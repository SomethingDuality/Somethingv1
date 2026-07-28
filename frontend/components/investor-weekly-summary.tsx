"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText, FileVideo, FileAudio, Presentation, Link2,
  Radar, ShieldCheck, Target, Compass, ArrowUpRight, Sparkles, Loader2,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Corners, hudStagger, hudItem as fieldItem, SomethingMark } from "@/components/hud"
import apiClient from "@/lib/axios"

const fieldStagger = hudStagger

function computeOverlap(domains: string[] = [], interests: string[] = []): string[] {
  const lc = interests.map((i) => i.toLowerCase())
  return (domains || []).filter((d) =>
    lc.some((i) => i.includes(d.toLowerCase()) || d.toLowerCase().includes(i))
  )
}

function getInitials(n = "") {
  return n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"
}

function docIcon(type = "") {
  const t = type.toLowerCase()
  if (t.includes("video")) return FileVideo
  if (t.includes("audio")) return FileAudio
  if (t.includes("present") || t.includes("deck")) return Presentation
  return FileText
}

type Scored = { p: any; ov: string[]; relevance: number }

export function InvestorWeeklySummary() {
  const [projects, setProjects] = useState<any[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setIsLoading(true)
      try {
        // Attempt to fetch profile interests from backend
        try {
          const profileRes = await apiClient.get("/investor/profile")
          if (profileRes.data?.interests?.length && isMounted) {
            setInterests(profileRes.data.interests)
          }
        } catch {
          // Fall back to local investor profile preferences if API endpoint is pending backend dev
          const str = typeof window !== "undefined" ? localStorage.getItem("investor_profile_data") : null
          if (str && isMounted) {
            try {
              const p = JSON.parse(str)
              if (p.interests && p.interests.length) setInterests(p.interests)
            } catch { /* ignore */ }
          }
        }

        // Attempt to fetch ideas/projects from backend API
        try {
          const ideasRes = await apiClient.get("/ideas")
          const fetchedIdeas = Array.isArray(ideasRes.data)
            ? ideasRes.data
            : ideasRes.data?.ideas || []
          if (isMounted) {
            setProjects(fetchedIdeas)
          }
        } catch {
          // Fall back to projects store or empty state for backend dev
          try {
            const { getProjects } = require("@/lib/projects-store")
            if (isMounted) {
              setProjects(getProjects() || [])
            }
          } catch {
            if (isMounted) setProjects([])
          }
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  const { matched, outside } = useMemo(() => {
    const scored: Scored[] = projects.map((p) => {
      const ov = computeOverlap(p.domains || p.tags || (p.category ? [p.category] : []), interests)
      const relevance = Math.min(
        99,
        62 + ov.length * 11 + Math.round(((p.trustPoints || 60) - 60) / 2.5)
      )
      return { p, ov, relevance }
    })
    const matched = scored
      .filter((s) => s.ov.length > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 4)
    const outside = scored
      .filter((s) => s.ov.length === 0)
      .sort((a, b) => (b.p.trustPoints || 0) - (a.p.trustPoints || 0))
      .slice(0, 3)
    return { matched, outside }
  }, [projects, interests])

  useEffect(() => {
    if (matched.length && !matched.some((m) => m.p.id === activeId)) {
      setActiveId(matched[0].p.id)
    }
  }, [matched, activeId])

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-border/40 p-6 sm:p-8 flex items-center justify-center min-h-[200px]">
        <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-brand-accent" />
          <span>Scanning thesis signals...</span>
        </div>
      </div>
    )
  }

  if (matched.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-border/30 p-6 sm:p-8 bg-white/[0.01]">
        <div className="flex items-center gap-3.5 pb-4 border-b border-border/20">
          <SomethingMark size={40} />
          <div>
            <h2 className="text-lg font-serif font-light text-foreground tracking-tight">Weekly Signal</h2>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              {interests.length ? `Thesis: ${interests.join(" · ")}` : "No thesis interests selected yet"}
            </p>
          </div>
        </div>
        <div className="py-8 text-center space-y-2">
          <p className="text-sm font-sans text-muted-foreground">No active ideas match your investment thesis yet.</p>
          <p className="text-xs font-mono text-foreground/40">New dealflow will automatically populate when published by founders.</p>
        </div>
      </div>
    )
  }

  const active = matched.find((m) => m.p.id === activeId) || matched[0]
  const ap = active.p
  const founder = (ap.founders && ap.founders[0]) || { name: ap.author || ap.founderName || "Founder", role: "Founder", bio: "" }
  const docs = [
    ...(ap.attachments || []).map((a: any) => ({ label: a.name, meta: a.size, type: a.type })),
    ...(ap.uploads || []).map((u: any) => ({ label: u.label, meta: u.type === "link" ? "external" : u.type, type: u.type })),
  ].slice(0, 4)

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/40 p-6 sm:p-8">
      {/* Ambient blurred background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 backdrop-blur-2xl bg-white/[0.015]" />
        <div className="absolute -top-24 -left-16 h-[380px] w-[380px] rounded-full bg-brand-accent/[0.10] blur-[120px] animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute -bottom-24 right-0 h-[420px] w-[420px] rounded-full bg-[#8293A4]/[0.10] blur-[130px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute top-1/3 left-1/2 h-[300px] w-[300px] rounded-full bg-[#F472B6]/[0.05] blur-[120px]" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-border/20">
        <div className="flex items-center gap-3.5">
          <SomethingMark size={44} />
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-serif font-light text-foreground tracking-tight">This Week&apos;s Signal</h2>
              <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.18em] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" /> Live
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              {matched.length} ideas matched your thesis · {interests.slice(0, 3).join(" · ")}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-brand-accent">
          <Radar className="h-3.5 w-3.5" /> Synergy Scan
        </div>
      </div>

      {/* Master-detail: matched idea cards + HUD dossier */}
      <div className="grid gap-6 lg:grid-cols-5 pt-6">
        {/* Left: matched idea chips */}
        <div className="lg:col-span-2 space-y-2.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-foreground/40 flex items-center gap-1.5 pb-1">
            <Target className="h-3 w-3" /> Matched to your thesis
          </div>
          {matched.map((s) => {
            const isActive = s.p.id === active.p.id
            return (
              <button
                key={s.p.id}
                onMouseEnter={() => setActiveId(s.p.id)}
                onFocus={() => setActiveId(s.p.id)}
                className={cn(
                  "group relative w-full text-left rounded-xl border px-4 py-3 transition-all duration-300 cursor-pointer overflow-hidden",
                  isActive
                    ? "border-brand-accent/40 bg-brand-accent/[0.06] shadow-[0_0_24px_-6px_var(--brand-accent)]"
                    : "border-border/20 bg-white/[0.02] hover:border-border/40 hover:bg-white/[0.035]"
                )}
              >
                {isActive && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-brand-accent" />}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground/90 truncate">{s.p.name || s.p.title}</span>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-foreground/40 border border-border/20 rounded px-1.5 py-0.5 shrink-0">{s.p.stage || "Idea"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {s.ov.slice(0, 3).map((t) => (
                        <span key={t} className="text-[9px] font-mono text-brand-accent bg-brand-accent/10 border border-brand-accent/20 rounded px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-lg font-serif font-light text-emerald-400 tabular-nums leading-none">{s.relevance}%</span>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-foreground/35 mt-1">match</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: HUD dossier */}
        <div className="lg:col-span-3">
          <div className="relative rounded-2xl border border-border/30 bg-background/40 backdrop-blur-xl p-5 sm:p-6 min-h-[320px] overflow-hidden">
            <Corners />
            <motion.div
              key={`scan-${ap.id}`}
              initial={{ y: "-100%", opacity: 0.5 }}
              animate={{ y: "1200%", opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="pointer-events-none absolute left-0 right-0 h-16 bg-gradient-to-b from-brand-accent/10 to-transparent"
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={ap.id}
                variants={fieldStagger}
                initial="hidden"
                animate="show"
                className="relative space-y-5"
              >
                {/* Title row */}
                <motion.div variants={fieldItem} className="flex items-start justify-between gap-3 pb-4 border-b border-border/20">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-brand-accent mb-1">Dossier</div>
                    <h3 className="text-xl font-serif font-light text-foreground tracking-tight">{ap.name || ap.title}</h3>
                    <p className="text-[11px] font-mono text-foreground/40 mt-0.5">{ap.stage || "Seed"} · {ap.location || "Remote"} · Trust {ap.trustPoints || 80}</p>
                  </div>
                  <Link href={`/investor/search/${ap.id}`} className="shrink-0 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-brand-accent hover:text-brand-accent/80 border border-brand-accent/20 rounded-lg px-2.5 py-1.5 transition">
                    Open <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </motion.div>

                {/* Founder */}
                <motion.div variants={fieldItem} className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-accent/10 border border-brand-accent/25 grid place-items-center text-xs font-mono font-bold text-brand-accent shrink-0">
                    {getInitials(founder.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-foreground/40">Founder</div>
                    <div className="text-sm font-semibold text-foreground/90">{founder.name} <span className="text-foreground/40 font-normal font-mono text-xs">· {founder.role || "Founder"}</span></div>
                    {founder.bio && <p className="text-xs text-foreground/55 font-light leading-relaxed mt-0.5">{founder.bio}</p>}
                  </div>
                </motion.div>

                {/* Description */}
                <motion.div variants={fieldItem}>
                  <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-foreground/40 mb-1.5 flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> What it is</div>
                  <p className="text-[13px] text-foreground/75 font-light leading-relaxed line-clamp-3">{ap.description || ap.desc || ap.summary}</p>
                </motion.div>

                {/* Docs + Relevance */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <motion.div variants={fieldItem}>
                    <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-foreground/40 mb-2 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Docs submitted</div>
                    <div className="space-y-1.5">
                      {docs.length === 0 && <span className="text-[11px] text-foreground/30 font-mono">No documents attached.</span>}
                      {docs.map((d, i) => {
                        const Icon = d.type === "link" ? Link2 : docIcon(d.type)
                        return (
                          <div key={i} className="flex items-center gap-2 text-[11px] text-foreground/70 bg-white/[0.02] border border-border/15 rounded-lg px-2.5 py-1.5">
                            <Icon className="h-3.5 w-3.5 text-brand-accent/70 shrink-0" />
                            <span className="truncate flex-1">{d.label}</span>
                            <span className="text-[9px] font-mono text-foreground/35 uppercase shrink-0">{d.meta}</span>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>

                  <motion.div variants={fieldItem}>
                    <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-foreground/40 mb-2 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Relevance to your thesis</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {active.ov.map((t) => (
                        <span key={t} className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{t}</span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-foreground/45">
                        <span>Thesis alignment</span>
                        <span className="text-emerald-400 font-bold">{active.relevance}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${active.relevance}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-emerald-400/80"
                        />
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Outside-thesis section */}
      {outside.length > 0 && (
        <div className="pt-8 mt-8 border-t border-border/20">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#8293A4] flex items-center gap-1.5 pb-3">
            <Compass className="h-3 w-3" /> High potential · outside your thesis
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {outside.map((s) => {
              const f = (s.p.founders && s.p.founders[0]) || { name: s.p.author || s.p.founderName || "Founder", role: "Founder" }
              const docCount = (s.p.attachments || []).length + (s.p.uploads || []).length
              return (
                <motion.div
                  key={s.p.id}
                  whileHover={{ y: -3 }}
                  className="group relative rounded-xl border border-[#8293A4]/20 bg-[#8293A4]/[0.03] p-4 overflow-hidden transition-colors hover:border-[#8293A4]/40"
                >
                  <Corners colorClass="border-[#8293A4]/40" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground/90 truncate">{s.p.name || s.p.title}</span>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-[#8293A4] border border-[#8293A4]/25 rounded px-1.5 py-0.5 shrink-0">{s.p.stage || "Idea"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(s.p.domains || s.p.tags || []).slice(0, 3).map((t: string) => (
                      <span key={t} className="text-[9px] font-mono text-foreground/45 bg-white/[0.02] border border-border/15 rounded px-1.5 py-0.5">{t}</span>
                    ))}
                  </div>
                  <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300">
                    <div className="overflow-hidden">
                      <div className="pt-3 mt-3 border-t border-border/15 space-y-1.5">
                        <p className="text-[11px] text-foreground/55 font-light leading-relaxed line-clamp-2">{s.p.desc || s.p.description || s.p.summary}</p>
                        <div className="flex items-center justify-between text-[10px] font-mono text-foreground/40 pt-1">
                          <span>{f.name} · {f.role}</span>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {docCount} docs</span>
                        </div>
                        <div className="text-[10px] font-mono text-[#8293A4] flex items-center gap-1">
                          <Compass className="h-3 w-3" /> Adjacent · Trust {s.p.trustPoints || 75}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
