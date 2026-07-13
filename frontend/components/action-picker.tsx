"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Option = {
  id: string
  label: string
  sub: string
  href: string
  accent: string
  icon: string
}

const OPTIONS: Option[] = [
  {
    id: "investor-signup",
    label: "Investor",
    sub: "Sign up and discover founders worth backing",
    href: "/signup?role=investor",
    accent: "#E3C27A",
    icon: "◈",
  },
  {
    id: "founder-signup",
    label: "Founder",
    sub: "Sign up and share the idea you've been hiding",
    href: "/signup?role=founder",
    accent: "#34D399",
    icon: "◉",
  },
  {
    id: "demo-investor",
    label: "Investor view",
    sub: "See the platform as an investor — with mock data",
    href: "/investor",
    accent: "#F472B6",
    icon: "◎",
  },
  {
    id: "demo-founder",
    label: "Founder view",
    sub: "See the platform as a founder — with mock data",
    href: "/founder",
    accent: "#818CF8",
    icon: "◐",
  },
]

export function ActionPicker({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Get started options"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        style={{ animation: "fadeIn 0.2s ease" }}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg mx-4 mb-6 sm:mb-0 rounded-2xl border border-white/10 bg-[#0e0e10] overflow-hidden shadow-2xl"
        style={{ animation: "slideUp 0.28s cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-1">Something</p>
              <h2 className="text-lg font-semibold tracking-tight">How would you like to start?</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="p-3 grid grid-cols-2 gap-2">
          {OPTIONS.map((opt) => (
            <Link
              key={opt.id}
              href={opt.href}
              onClick={onClose}
              onMouseEnter={() => setHovered(opt.id)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "group relative rounded-xl border p-4 transition-all duration-200",
                "flex flex-col gap-1 cursor-pointer",
                hovered === opt.id
                  ? "border-white/20 bg-white/5"
                  : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
              )}
              style={{
                boxShadow:
                  hovered === opt.id
                    ? `0 0 0 1px ${opt.accent}22, inset 0 0 24px ${opt.accent}08`
                    : "none",
              }}
            >
              <span
                className="text-xl mb-1 transition-transform duration-200 group-hover:scale-110 inline-block"
                style={{ color: opt.accent }}
              >
                {opt.icon}
              </span>
              <span className="text-sm font-semibold tracking-tight">{opt.label}</span>
              <span className="text-xs text-white/50 leading-snug">{opt.sub}</span>

              {/* Accent glow */}
              {hovered === opt.id && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl opacity-10 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at top left, ${opt.accent}, transparent 70%)`,
                  }}
                />
              )}
            </Link>
          ))}
        </div>

        <div className="px-6 pb-5 pt-1">
          <p className="text-xs text-white/30 text-center">
            Mutual NDAs by default · Ideas protected on-chain
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        `
      }} />
    </div>
  )
}
