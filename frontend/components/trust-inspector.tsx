"use client"

import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Breakdown = {
  ndas?: number
  escrowReleases?: number
  receipts?: number
  history?: number
}

export function TrustInspector({
  trust,
  baseline = 75,
  breakdown,
  className,
}: {
  trust: number
  baseline?: number
  breakdown?: Breakdown
  className?: string
}) {
  const tp = clamp(trust, 1, 100)
  const delta = tp - baseline

  return (
    <div className={cn("grid gap-1", className)}>
      <div className="flex items-center justify-between text-xs text-white/70">
        <span>Trust</span>
        <span className="text-white">
          <span className="font-semibold">{tp}</span>
          <span className={cn("ml-1", delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-white/60")}>
            ({delta > 0 ? `+${delta}` : delta})
          </span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#0f1012]" aria-label="Trust meter">
        <div className="h-2 rounded-full bg-white" style={{ width: `${tp}%`, opacity: 0.85 }} />
      </div>

      {breakdown && (
        <div className="mt-1">
          <Popover>
            <PopoverTrigger className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white">
              <Info className="h-3.5 w-3.5" />
              Breakdown
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-[#101113] text-white border-[#1a1b1e]">
              <div className="text-xs text-white/60 mb-2">Signals contributing to trust</div>
              <ul className="grid gap-1 text-sm">
                <li className="flex items-center justify-between">
                  <span>Mutual NDAs</span>
                  <span className="text-white/80">{breakdown.ndas ?? 0}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Escrow releases</span>
                  <span className="text-white/80">{breakdown.escrowReleases ?? 0}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Verified receipts</span>
                  <span className="text-white/80">{breakdown.receipts ?? 0}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Contributor history</span>
                  <span className="text-white/80">{breakdown.history ?? 0}</span>
                </li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
