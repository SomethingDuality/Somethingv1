"use client"
import { cn } from "@/lib/utils"
import { useState } from "react"

const seeds = [
  "Climate hardware",
  "Open firmware", 
  "Neurotech",
  "Bio tooling",
  "Creator infra",
  "Local-first",
  "Edge AI",
  "Robotics", 
  "Public goods",
  "Privacy",
  "Alt education",
  "DePIN",
]

const matchTypes = [
  {
    label: "Co-founder",
    title: "Perfect founder complement",
    description: "Nothing looks for viability overlap, Something for people‐fit. Your active tags bias the match."
  },
  {
    label: "Team",
    title: "Early team members",
    description: "Find technical co-founders and key hires who share your vision and complement your skills."
  },
  {
    label: "Stealth",
    title: "Stealth startup opportunities", 
    description: "Get matched with promising pre-launch companies building in your areas of interest."
  },
  {
    label: "Investor",
    title: "Aligned investor network",
    description: "Connect with investors who actively fund projects in your selected focus areas."
  },
  {
    label: "Advisor",
    title: "Domain expert advisors",
    description: "Access seasoned operators and technical experts in your chosen verticals."
  },
  {
    label: "Community",
    title: "Builder communities",
    description: "Join exclusive groups of founders and builders working on similar challenges."
  }
]

export function MatchCabinet() {
  const [active, setActive] = useState<string[]>(["Climate hardware", "Edge AI", "Privacy"])
  
  function toggle(tag: string) {
    setActive((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }
  
  return (
    <section id="match">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Idea alignment lab</h2>
      <p className="text-white/70 text-sm sm:text-base mt-2 max-w-2xl">
        Pick your signals. We use them to match you with co-founders, teams, and stealth startups that share your
        convictions.
      </p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {seeds.map((s) => {
            const on = active.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={cn(
                  "group relative rounded-full px-3 py-1.5 text-xs transition",
                  "border",
                  on
                    ? "border-[#e3c27a]/50 text-white bg-[#e3c27a]/10"
                    : "border-white/15 text-white/80 hover:bg-white/5",
                )}
                aria-pressed={on}
                aria-label={`Toggle ${s}`}
              >
                <span className="relative z-10">{s}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 rounded-full blur-md transition-opacity",
                    on ? "opacity-70" : "opacity-0 group-hover:opacity-30",
                  )}
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(227,194,122,0.5), rgba(244,114,182,0.35), rgba(52,211,153,0.5))",
                  }}
                />
              </button>
            )
          })}
        </div>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matchTypes.map((match, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 p-4 sm:p-5">
              <div
                className="absolute -inset-1 opacity-20 blur-2xl"
                style={{
                  background:
                    "radial-gradient(400px 200px at 10% 10%, rgba(227,194,122,0.20), transparent 60%), radial-gradient(300px 200px at 90% 80%, rgba(52,211,153,0.18), transparent 55%)",
                }}
              />
              <div className="relative">
                <div className="text-xs uppercase tracking-[0.25em] text-white/60">{match.label}</div>
                <div className="mt-1 text-base font-semibold">{match.title}</div>
                <p className="text-white/70 text-sm mt-1">
                  {match.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}