"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type Node = {
  id: string
  amount: number
  color: string
  desc: string
}

const nodes: Node[] = [
  { id: "Engineering M1", amount: 8000, color: "#a3e635", desc: "Milestone #1 release accepted" },
  { id: "Design sprints", amount: 2200, color: "#e3c27a", desc: "Two sprint cycles" },
  { id: "Cloud credits", amount: 900, color: "#f472b6", desc: "Infra top-up" },
  { id: "Engineering M2", amount: 10000, color: "#34d399", desc: "Milestone #2 released" },
  { id: "Ops & admin", amount: 700, color: "#f97316", desc: "Backoffice ops" },
]

export function FundingOrbit() {
  const [active, setActive] = useState<Node | null>(null)
  const total = useMemo(() => nodes.reduce((s, n) => s + n.amount, 0), [])

  return (
    <section id="funding">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Transparent community funding</h2>
      <p className="text-white/50 text-sm sm:text-base mt-2 max-w-2xl">
        Funds live in escrow and release on verified milestones. Every spend is visible. Radically simple.
      </p>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="relative rounded-2xl border border-white/10 bg-black/40 p-6 overflow-hidden">
          <div className="absolute inset-0 grid place-items-center">
            {/* Orbit rings */}
            <div className="relative h-[360px] w-[360px] sm:h-[420px] sm:w-[420px]">
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-6 rounded-full border border-white/10" />
              <div className="absolute inset-12 rounded-full border border-white/10" />
              <div className="absolute inset-20 rounded-full border border-white/10" />

              {/* Spinner */}
              <div
                className="absolute inset-0 animate-[spin_30s_linear_infinite] hover:[animation-duration:60s]"
                aria-hidden="true"
              >
                {nodes.map((n, i) => {
                  const angle = (i / nodes.length) * Math.PI * 2
                  const radius = 150 + (i % 3) * 26
                  const x = 180 + Math.cos(angle) * radius
                  const y = 180 + Math.sin(angle) * radius
                  return (
                    <button
                      key={n.id}
                      onMouseEnter={() => setActive(n)}
                      onFocus={() => setActive(n)}
                      onMouseLeave={() => setActive(null)}
                      onBlur={() => setActive(null)}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: x, top: y }}
                      aria-label={n.id}
                    >
                      <span
                        className="block h-3.5 w-3.5 rounded-full ring-2 ring-white/70"
                        style={{ backgroundColor: n.color }}
                      />
                    </button>
                  )
                })}
              </div>

              {/* Crosshair */}
              <div className="absolute inset-0">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10" />
              </div>
            </div>
          </div>

          {/* Center readout */}
          <div className="relative grid place-items-center">
            <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-center">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Total disbursed</div>
              <div className="text-2xl font-semibold mt-0.5">${total.toLocaleString()}</div>
              <div className="text-xs text-white/60 mt-1">Multi-sig escrow • Milestone releases • Receipts</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/30 p-4 sm:p-6">
          {!active && <p className="text-sm text-white/60">Hover a node to see details.</p>}
          {active && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/70"
                  style={{ backgroundColor: active.color }}
                />
                <div className="text-base font-semibold">{active.id}</div>
              </div>
              <div className="text-sm text-white/70">{active.desc}</div>
              <div className="text-sm">
                <span className="text-white/60">Amount:</span>{" "}
                <span className="font-semibold">${active.amount.toLocaleString()}</span>
              </div>
              <div className="text-xs text-white/60">
                Each release anchors to chain with a hash of the milestone + receipts.
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {nodes.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded-lg border p-3",
                  active?.id === n.id
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">{n.id}</span>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: n.color }} />
                </div>
                <div className="text-sm font-semibold mt-1">${n.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
