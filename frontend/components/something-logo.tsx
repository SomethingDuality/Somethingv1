"use client"

import Image from "next/image"

export function SomethingLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-8 w-8 shrink-0">
        {/* Subtle outer glow */}
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: "conic-gradient(from 210deg, #e3c27a, #34d399 35%, #f472b6 60%, #e3c27a 100%)",
            filter: "blur(6px)",
            opacity: 0.4,
          }}
          aria-hidden="true"
        />

        {/* Main image container */}
        <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
          <Image
            src="/TheThing.png"
            alt="Something"
            fill
            className="object-contain"
            sizes="32px"
            priority
          />
        </div>
      </div>

      <div className="leading-tight">
        <div className="text-base font-semibold tracking-[0.04em] text-white">Something</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">{"Nothing • Something"}</div>
      </div>
    </div>
  )
}
