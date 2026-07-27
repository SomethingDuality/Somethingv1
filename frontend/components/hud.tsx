"use client"

import { cn } from "@/lib/utils"

// Corner brackets for a HUD frame. Pass colorClass to recolor (e.g. per mode).
export function Corners({
  colorClass = "border-brand-accent/50",
  className,
}: {
  colorClass?: string
  className?: string
}) {
  const base = cn("absolute w-3 h-3 pointer-events-none", colorClass, className)
  return (
    <>
      <span className={cn(base, "top-0 left-0 border-t border-l")} />
      <span className={cn(base, "top-0 right-0 border-t border-r")} />
      <span className={cn(base, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(base, "bottom-0 right-0 border-b border-r")} />
    </>
  )
}

// Staggered blur→sharp field reveal.
export const hudStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const hudItem = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: "easeOut" },
  },
} as const

// The Something brand mark — white creature on a black tile with an accent glow.
export function SomethingMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("relative shrink-0", className)} style={{ height: size, width: size }}>
      <div className="absolute -inset-1.5 rounded-2xl bg-brand-accent/25 blur-lg opacity-70" aria-hidden />
      <div className="relative rounded-xl overflow-hidden bg-black border border-white/15 flex items-center justify-center shadow-lg" style={{ height: size, width: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/TheThing.png"
          alt="Something"
          className="object-contain invert mix-blend-screen"
          style={{ height: size, width: size }}
        />
      </div>
    </div>
  )
}
