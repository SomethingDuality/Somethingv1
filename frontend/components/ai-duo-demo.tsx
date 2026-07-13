"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { BrainCircuit, ShieldCheck, Coins } from "lucide-react"

type Persona = "mut" | "iny" | "together"

const starterIdeas = [
  "A marketplace connecting climate founders with hardware engineers.",
  "An AI co-pilot that writes and tests firmware for robotics.",
  "A community-funded stipend for job seekers joining early-stage startups.",
]

function respond(persona: Persona, text: string) {
  const t = text.toLowerCase()
  const hasRev = /revenue|money|pricing|price|business model/.test(t)
  const hasTeam = /team|hire|co[-\s]?founder|talent|engineer|designer/.test(t)
  const hasRisk = /risk|competition|moat|defensible|ip/.test(t)
  const hasFund = /fund|funding|invest|grant|crowd|token/.test(t)
  const hasUser = /user|customer|market|segment|pain/.test(t)

  const mut = [
    "What is the wedge? Be specific about the first segment you will win and why you win now.",
    hasRev
      ? "Outline a 3-tier pricing with gross margin assumptions. CAC/LTV napkin math please."
      : "How will this make money? Give me a sane path to revenue with margins.",
    hasRisk
      ? "Name your top 2 risks and a falsifiable test you'll run in the next 2 weeks."
      : "What's your moat after V1 ships? Consider data, distribution, or switching costs.",
    hasFund
      ? "If community-funded, define clear release milestones with objective acceptance criteria."
      : "Don't raise too early. Prove pull with 10 design partner commitments.",
  ]

  const iny = [
    "I like the intent. Let's articulate the core promise in one sentence users can repeat.",
    hasUser
      ? "Who exactly feels the pain weekly? Sketch a 3-step journey from problem → aha → habit."
      : "Let's pick a very narrow first user and write their 'day in the life'.",
    hasTeam
      ? "Map the initial team: you, one technical partner, one design partner. What do they own?"
      : "Make an honest 'skills map' and where you want a complementary co-founder.",
    hasFund
      ? "Transparent funding builds trust. Show a simple dashboard of inflows → escrow → releases."
      : "Pilot with 5 champions before money moves; trust first, cash later.",
  ]

  if (persona === "mut") return mut
  if (persona === "iny") return iny

  // together: weave both
  const together: string[] = []
  together.push(mut[0])
  together.push(iny[0])
  together.push(hasUser ? iny[1] : mut[1])
  together.push(hasRev ? mut[1] : "Draft a scrappy revenue experiment you can run in 7 days.")
  together.push(hasFund ? mut[3] : iny[3])
  return together
}

export function AIduoDemo() {
  const [persona, setPersona] = useState<Persona>("together")
  const [idea, setIdea] = useState(starterIdeas[0])
  const [out, setOut] = useState<string[] | null>(null)
  const disabled = idea.trim().length < 10

  const suggestions = useMemo(() => starterIdeas, [])

  function run() {
    const lines = respond(persona, idea)
    setOut(lines)
  }

  return (
    <Card className="bg-white/5 border-white/10 shadow-2xl">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge
            variant="secondary"
            className={cn("bg-[#c6a15b]/20 text-[#e9d8a6] border-[#c6a15b]/30", "hidden sm:inline-flex")}
          >
            Duo pilot
          </Badge>
          <div className="text-sm text-white/60">
            Get feedback from <span className="text-white">Mut</span> and <span className="text-white">Iny</span>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPersona("mut")}
              className={cn(
                "text-xs rounded-full px-3 py-1.5 border transition-colors",
                persona === "mut"
                  ? "border-[#c6a15b] bg-[#c6a15b]/15 text-white"
                  : "border-white/15 text-white/80 hover:bg-white/5",
              )}
              aria-pressed={persona === "mut"}
            >
              Mut • Investor
            </button>
            <button
              onClick={() => setPersona("iny")}
              className={cn(
                "text-xs rounded-full px-3 py-1.5 border transition-colors",
                persona === "iny"
                  ? "border-emerald-400/60 bg-emerald-400/10 text-white"
                  : "border-white/15 text-white/80 hover:bg-white/5",
              )}
              aria-pressed={persona === "iny"}
            >
              Iny • CEO
            </button>
            <button
              onClick={() => setPersona("together")}
              className={cn(
                "text-xs rounded-full px-3 py-1.5 border transition-colors",
                persona === "together"
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/15 text-white/80 hover:bg-white/5",
              )}
              aria-pressed={persona === "together"}
            >
              Together
            </button>
          </div>

          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your idea in 2–3 sentences..."
            className="min-h-[96px] bg-black/30 border-white/10 text-white placeholder:text-white/40"
          />

          <div className="flex flex-wrap items-center gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setIdea(s)}
                className="text-xs rounded-full px-3 py-1.5 border border-white/10 text-white/80 hover:bg-white/5 transition"
                aria-label={`Use example idea ${i + 1}`}
              >
                Example {i + 1}
              </button>
            ))}
            <Button
              onClick={run}
              disabled={disabled}
              className={cn(
                "ml-auto bg-white/90 hover:bg-white text-black",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset,0_10px_40px_rgba(255,255,255,0.08)]",
              )}
            >
              <BrainCircuit className="h-4 w-4 mr-2" />
              Get feedback
            </Button>
          </div>

          <div className="mt-2 rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/20 p-4">
            {!out && (
              <div className="text-sm text-white/60">
                The duo will challenge and champion your idea. No external calls here&mdash;just a taste of the
                experience.
              </div>
            )}
            {out && (
              <ul className="space-y-3 text-sm">
                {out.map((line, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-white/50" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-3 mt-4 text-xs text-white/60">
              <ShieldCheck className="h-4 w-4 text-[#c6a15b]" />
              <span>{"Mutual NDAs + blockchain idea hashes to deter copying and prove authorship."}</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-white/60">
              <Coins className="h-4 w-4 text-emerald-300" />
              <span>{"Escrowed community funding with milestone-based releases and spend transparency."}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
