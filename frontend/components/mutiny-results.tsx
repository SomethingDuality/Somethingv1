"use client"

import React, { useState, useEffect } from "react"
import { MutinyResponse } from "@/lib/mock-mutiny"
import { logFeedback } from "@/lib/mutiny-feedback"
import { toast } from "@/components/ui/use-toast"
import { User, Building, FileText, Award } from "lucide-react"
import { cn } from "@/lib/utils"


const ACCENTS = {
  emerald: { color: "#8EA38E", text: "text-[#8EA38E]", hoverText: "hover:text-[#8EA38E]/80" },
  indigo: { color: "#E2DFD5", text: "text-[#E2DFD5]", hoverText: "hover:text-[#E2DFD5]/80" },
  violet: { color: "#8293A4", text: "text-[#8293A4]", hoverText: "hover:text-[#8293A4]/80" },
  amber: { color: "#C88E72", text: "text-[#C88E72]", hoverText: "hover:text-[#C88E72]/80" },
}

export default function MutinyResults({
  data,
  accentKey = "emerald",
}: {
  data: MutinyResponse | null
  accentKey?: string
}) {
  const [activeAccentKey, setActiveAccentKey] = useState<keyof typeof ACCENTS>("emerald")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAccent = localStorage.getItem("founder_settings_accent") as keyof typeof ACCENTS
      if (storedAccent && ACCENTS[storedAccent]) {
        setActiveAccentKey(storedAccent)
      } else if (accentKey && ACCENTS[accentKey as keyof typeof ACCENTS]) {
        setActiveAccentKey(accentKey as keyof typeof ACCENTS)
      }
    }
  }, [accentKey])

  const activeAccent = ACCENTS[activeAccentKey]

  if (!data) return null

  const hasPeople = !!data.people && data.people.length > 0
  const hasInvestors = !!data.investors && data.investors.length > 0
  const hasIdeas = !!data.ideas && data.ideas.length > 0
  const hasPatents = !!data.patents && data.patents.length > 0

  return (
    <div className="space-y-6 pt-4 border-t border-white/5 select-text font-sans">
      
      {/* 1. Builders Match List */}
      {hasPeople && (
        <div className="space-y-3">
          <div className="text-xs font-bold font-mono uppercase tracking-widest text-foreground/50 flex items-center gap-1.5">
            <User className="h-3 w-3" /> Conviction Overlap (Co-Founders)
          </div>
          <div className="space-y-3 pl-4 border-l border-white/5">
            {data.people!.map((p) => (
              <div key={p.id} className="text-sm space-y-1">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-semibold text-foreground/90">{p.name}</span>
                  <span className="text-foreground/45 font-mono text-xs">{p.role}</span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/5 px-1.5 py-0.2 rounded border border-emerald-500/10">
                    {Math.round(p.similarityScore * 100)}% match
                  </span>
                </div>
                {p.headline && (
                  <p className="text-foreground/60 italic text-xs sm:text-sm font-light leading-normal">{p.headline}</p>
                )}
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs">
                  <span className="text-foreground/40">Overlap:</span>
                  {p.reasons.map((r, idx) => (
                    <span key={idx} className="text-foreground/70 font-mono text-xs bg-white/[0.02] border border-white/5 px-1.5 py-0.2 rounded">
                      {r}
                    </span>
                  ))}
                  <span className="text-foreground/20">|</span>
                  <button
                    onClick={() => {
                      logFeedback({ id: Date.now().toString(), type: 'introduce', targetType: 'person', targetId: p.id, timestamp: new Date().toISOString() })
                      toast({ title: 'Feedback saved', description: `Requested intro to ${p.name}` })
                    }}
                    className={cn("underline cursor-pointer bg-transparent border-0 p-0 text-xs font-medium transition", activeAccent.text, activeAccent.hoverText)}
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => {
                      logFeedback({ id: Date.now().toString(), type: 'accept', targetType: 'person', targetId: p.id, timestamp: new Date().toISOString() })
                      toast({ title: 'Accepted', description: `Accepted ${p.name}` })
                    }}
                    className="underline text-foreground/50 hover:text-foreground/75 cursor-pointer bg-transparent border-0 p-0 text-xs transition"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Investor Fit */}
      {hasInvestors && (
        <div className="space-y-3">
          <div className="text-xs font-bold font-mono uppercase tracking-widest text-foreground/50 flex items-center gap-1.5">
            <Building className="h-3 w-3" /> Investment Fit (VC & Angels)
          </div>
          <div className="space-y-3 pl-4 border-l border-white/5">
            {data.investors!.map((i) => (
              <div key={i.id} className="text-sm space-y-1">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-semibold text-foreground/90">{i.name}</span>
                  <span className="text-foreground/45 font-mono text-xs">{i.stage} Stage</span>
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/5 px-1.5 py-0.2 rounded border border-indigo-500/10">
                    {Math.round(i.matchScore * 100)}% fit
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs">
                  <span className="text-foreground/40">Focus:</span>
                  {i.sectors.map((sec, idx) => (
                    <span key={idx} className="text-foreground/75 font-mono text-xs bg-white/[0.02] border border-white/5 px-1.5 py-0.2 rounded">
                      {sec}
                    </span>
                  ))}
                  <span className="text-foreground/20">|</span>
                  <button
                    onClick={() => {
                      logFeedback({ id: Date.now().toString(), type: 'introduce', targetType: 'investor', targetId: i.id, timestamp: new Date().toISOString() })
                      toast({ title: 'Intro requested', description: `Requested intro to ${i.name}` })
                    }}
                    className={cn("underline cursor-pointer bg-transparent border-0 p-0 text-xs font-medium transition", activeAccent.text, activeAccent.hoverText)}
                  >
                    Request Intro
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Similar Ideas */}
      {hasIdeas && (
        <div className="space-y-3">
          <div className="text-xs font-bold font-mono uppercase tracking-widest text-foreground/50 flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> Overlap Concepts (Cohort)
          </div>
          <div className="space-y-3 pl-4 border-l border-white/5">
            {data.ideas!.map((it) => (
              <div key={it.id} className="text-sm space-y-1">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-semibold text-foreground/90">{it.title}</span>
                  <span className="text-foreground/45 font-mono text-xs">by {it.ownerName}</span>
                  <span className="text-xs font-mono text-foreground/60 bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
                    {Math.round(it.similarityScore * 100)}% overlap
                  </span>
                </div>
                <p className="text-foreground/75 text-xs sm:text-sm font-light leading-relaxed">{it.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Patents */}
      {hasPatents && (
        <div className="space-y-3">
          <div className="text-xs font-bold font-mono uppercase tracking-widest text-foreground/50 flex items-center gap-1.5">
            <Award className="h-3 w-3" /> Intellectual Property & Patents
          </div>
          <div className="space-y-3 pl-4 border-l border-white/5">
            {data.patents!.map((pat) => (
              <div key={pat.id} className="text-sm space-y-1">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-semibold text-foreground/90">{pat.title}</span>
                  <span className="text-foreground/45 font-mono text-xs">{pat.number} · {pat.assignee}</span>
                  <span className="text-xs font-mono text-pink-400 bg-pink-500/5 px-1.5 py-0.2 rounded border border-pink-500/10">
                    {Math.round(pat.similarityScore * 100)}% overlap
                  </span>
                </div>
                <p className="text-foreground/75 text-xs sm:text-sm font-light leading-relaxed">{pat.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
