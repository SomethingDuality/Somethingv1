"use client"

import { useMemo, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BrainCircuit } from "lucide-react"

type Persona = "nothing" | "something" | "combined"

function respond(persona: Persona, text: string) {
  const t = text.toLowerCase()
  const hasRev = /revenue|money|pricing|model|price/.test(t)
  const hasTeam = /team|hire|co[-\s]?founder|talent|engineer|designer/.test(t)
  const hasRisk = /risk|competition|moat|defensible|ip/.test(t)
  const hasFund = /fund|funding|invest|grant|crowd|token|escrow/.test(t)
  const hasUser = /user|customer|market|segment|pain|who/.test(t)

  const mut = [
    "Define a precise wedge and why now. Show me the first 50 users you win and how.",
    hasRev
      ? "3-tier pricing and napkin unit economics. Keep CAC payback #60; 6 months."
      : "What is the path to revenue within 90 days? Price points, margin, and payment flow.",
    hasRisk
      ? "Top two risks with falsifiable tests. Kill what doesn’t survive daylight."
      : "Name a moat beyond code: data, distribution, switching costs.",
    hasFund
      ? "Milestone ledger: objective criteria and escrow triggers."
      : "Don’t raise yet. Secure 10 design partners and commitments.",
  ]
  const iny = [
    "What is the promise a user can repeat to a friend? Keep it crisp and kind.",
    hasUser
      ? "Who hurts weekly? Map problem → aha → habit in 3 steps."
      : "Pick a painful, narrow first user. Write their 'day in the life'.",
    hasTeam
      ? "Draft a simple roles square: you, tech partner, design partner."
      : "Make a skills map. Where do you want your opposite?",
    hasFund
      ? "Transparency builds trust. Show inflows → escrow → releases → receipts."
      : "Prove trust before cash. 5 champions, weekly cadence, visible progress.",
  ]

  if (persona === "nothing") return mut
  if (persona === "something") return iny
  return [
    mut[0],
    iny[0],
    hasUser ? iny[1] : mut[1],
    hasRev ? mut[1] : "Run a 7‑day revenue experiment.",
    hasFund ? mut[3] : iny[3],
  ]
}

export function DuoSynth() {
  const [persona, setPersona] = useState<Persona>("combined")
  const [idea, setIdea] = useState(
    "A marketplace connecting climate founders with hardware engineers; community-funded with milestone releases.",
  )
  const [out, setOut] = useState<string[] | null>(null)
  const disabled = idea.trim().length < 10
  const examples = useMemo(
    () => [
      "An AI that drafts and tests firmware for robotics teams.",
      "Community stipend for job seekers joining seed startups.",
      "Privacy-first creator analytics with local-first sync.",
    ],
    [],
  )

  function run() {
    setOut(respond(persona, idea))
  }

  return (
    <section id="duo">
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>The duo, unfiltered</h2>
        <p className="text-white/70 text-sm sm:text-base mt-2 max-w-2xl">
          Nothing challenges viability. Something champions people and purpose. Pick a voice or combine both.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setPersona("nothing")}
              aria-pressed={persona === "nothing"}
              className={cn(
                "text-xs rounded-full px-3 py-1.5 border transition",
                persona === "nothing" ? "border-[#e3c27a] bg-[#e3c27a]/10 text-white" : "border-white/15 text-white/80",
              )}
            >
              Nothing • Investor
            </button>
            <button
              onClick={() => setPersona("something")}
              aria-pressed={persona === "something"}
              className={cn(
                "text-xs rounded-full px-3 py-1.5 border transition",
                persona === "something"
                  ? "border-emerald-400/60 bg-emerald-400/10 text-white"
                  : "border-white/15 text-white/80",
              )}
            >
              Something • Builder
            </button>
            <button
              onClick={() => setPersona("combined")}
              aria-pressed={persona === "combined"}
              className={cn(
                "text-xs rounded-full px-3 py-1.5 border transition",
                persona === "combined" ? "border-white/40 bg-white/10 text-white" : "border-white/15 text-white/80",
              )}
            >
              Combined
            </button>
          </div>

          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your idea in 2–3 sentences..."
            className="min-h-[110px] bg-black/30 border-white/15 text-white placeholder:text-white/40"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {examples.map((x, i) => (
              <button
                key={i}
                onClick={() => setIdea(x)}
                className="text-xs rounded-full px-3 py-1.5 border border-white/15 text-white/80 hover:bg-white/5"
                aria-label={`Use example ${i + 1}`}
              >
                Example {i + 1}
              </button>
            ))}
            <Button
              onClick={run}
              disabled={disabled}
              className="ml-auto rounded-full bg-white text-black hover:bg-[#e3c27a] hover:text-black"
            >
              <BrainCircuit className="h-4 w-4 mr-2" />
              Synthesize
            </Button>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/30 p-4 sm:p-6 overflow-hidden">
          <div
            className="absolute -inset-1 opacity-20 blur-2xl"
            style={{
              background:
                "radial-gradient(400px 160px at 15% 20%, rgba(227,194,122,0.20), transparent 60%), radial-gradient(500px 200px at 80% 70%, rgba(52,211,153,0.18), transparent 60%), radial-gradient(400px 140px at 50% 30%, rgba(244,114,182,0.18), transparent 60%)",
            }}
          />
          <div className="relative">
            {!out && <p className="text-sm text-white/60">Output appears here. No external calls—just a taste.</p>}
            {out && (
              <div className="grid gap-3">
                {out.map((line, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm backdrop-blur",
                      idx % 2 === 0
                        ? "border-[#e3c27a]/30 bg-[#e3c27a]/10 text-white"
                        : "border-emerald-400/30 bg-emerald-400/10 text-white",
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
