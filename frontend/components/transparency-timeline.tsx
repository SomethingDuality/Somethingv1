"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Spend = {
  date: string
  label: string
  amount: number
  category: "engineering" | "design" | "cloud" | "ops"
}

const sampleSpends: Spend[] = [
  { date: "2025-07-01", label: "Milestone #1 release", amount: 8000, category: "engineering" },
  { date: "2025-07-08", label: "Design sprints", amount: 2200, category: "design" },
  { date: "2025-07-12", label: "Cloud credits top-up", amount: 900, category: "cloud" },
  { date: "2025-07-19", label: "Milestone #2 partial", amount: 6000, category: "engineering" },
  { date: "2025-07-23", label: "Backoffice + ops", amount: 700, category: "ops" },
  { date: "2025-07-30", label: "Milestone #2 final", amount: 4000, category: "engineering" },
]

const palette: Record<Spend["category"], string> = {
  engineering: "#a3e635", // lime-400
  design: "#f5c06b", // warm gold
  cloud: "#60a5fa", // sky-ish but subtle usage
  ops: "#34d399", // emerald-400
}

export function TransparencyTimeline() {
  const [range, setRange] = useState<[number, number]>([0, sampleSpends.length - 1])
  const total = useMemo(() => sampleSpends.reduce((s, x) => s + x.amount, 0), [])
  const filtered = sampleSpends.slice(range[0], range[1] + 1)
  const byCat = filtered.reduce<Record<Spend["category"], number>>(
    (acc, x) => {
      acc[x.category] += x.amount
      return acc
    },
    { engineering: 0, design: 0, cloud: 0, ops: 0 },
  )

  return (
    <Card className="bg-white/[0.04] border-white/10">
      <CardContent className="p-4 sm:p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="text-sm text-white/70 mb-3">Escrow releases and expenses across the month</div>
            <div className="relative rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="grid grid-cols-12 gap-2">
                {sampleSpends.map((s, idx) => (
                  <div key={idx} className="col-span-2">
                    <div
                      className={cn(
                        "h-24 rounded-sm transition",
                        idx >= range[0] && idx <= range[1] ? "opacity-100" : "opacity-40 saturate-50",
                      )}
                      style={{
                        background: `linear-gradient(180deg, ${palette[s.category]} 0%, rgba(255,255,255,0.85) 100%)`,
                      }}
                      aria-label={`${s.label} ${s.amount.toLocaleString()} USD`}
                    />
                    <div className="mt-2 text-[10px] leading-tight text-white/70">{new Date(s.date).getDate()}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <input
                  type="range"
                  min={0}
                  max={sampleSpends.length - 1}
                  value={range[0]}
                  onChange={(e) => setRange(([, r]) => [Number.parseInt(e.target.value), r])}
                  className="w-full"
                  aria-label="Start index"
                />
                <input
                  type="range"
                  min={0}
                  max={sampleSpends.length - 1}
                  value={range[1]}
                  onChange={(e) => setRange(([l]) => [l, Number.parseInt(e.target.value)])}
                  className="w-full -mt-2"
                  aria-label="End index"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(byCat).map(([k, v]) => (
                <div key={k} className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/70 capitalize">{k}</div>
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: palette[k as keyof typeof palette] }}
                    />
                  </div>
                  <div className="text-sm font-semibold mt-1">${v.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-white/70">Total disbursed (month)</div>
              <div className="text-2xl font-semibold mt-1">${total.toLocaleString()}</div>
              <p className="text-xs text-white/60 mt-2">
                Each release ties to a milestone with objective criteria. Receipts can be attached for verification.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-white/70">
                <li>{"• Multi-sig escrow"}</li>
                <li>{"• On-chain anchors for releases"}</li>
                <li>{"• Privacy-preserving spend proofs"}</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
