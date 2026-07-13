"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// ─── Data ────────────────────────────────────────────────────────────────────

const NOTHING = {
  name: "Nothing",
  accent: "#E3C27A",
  role: "The critical investor",
  emoji: "⌀",
  question: "What breaks this idea?",
  desc: "When someone hears your idea and their face goes blank—that's Nothing. The hard questions. The investor lens. The daylight test that kills what shouldn't survive.",
  capabilities: [
    "Revenue model stress-testing",
    "Moat & defensibility analysis",
    "Risk falsification",
    "Market-timing critique",
  ],
}

const SOMETHING = {
  name: "Something",
  accent: "#34D399",
  role: "The empathetic builder",
  emoji: "◉",
  question: "What makes people stay?",
  desc: "When someone hears your idea and leans in—that's Something. The supporter. The builder who maps emotion to retention, and conviction to community.",
  capabilities: [
    "User journey mapping",
    "Emotional resonance testing",
    "Team & culture fit",
    "Trust-before-pitch strategy",
  ],
}

// ─── Scroll reveal ───────────────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ─── Animated counter for the center ─────────────────────────────────────────

function AnimatedMerge({ inView }: { inView: boolean }) {
  const words = ["Nothing", "→", "Something"]
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {words.map((w, i) => (
        <span
          key={w}
          className={cn(
            "transition-all duration-700",
            w === "→" ? "text-white/15 text-lg" : "text-sm font-semibold tracking-tight"
          )}
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(12px)",
            transitionDelay: `${300 + i * 120}ms`,
            color: w === "Nothing" ? NOTHING.accent : w === "Something" ? SOMETHING.accent : undefined,
          }}
        >
          {w}
        </span>
      ))}
    </div>
  )
}

// ─── Persona card ────────────────────────────────────────────────────────────

function PersonaCard({
  data,
  side,
  hovered,
  onHover,
  inView,
  delay,
}: {
  data: typeof NOTHING
  side: "left" | "right"
  hovered: "left" | "right" | null
  onHover: (v: "left" | "right" | null) => void
  inView: boolean
  delay: number
}) {
  const isActive = hovered === side
  const isDimmed = hovered !== null && !isActive

  return (
    <div
      onMouseEnter={() => onHover(side)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "group relative cursor-default overflow-hidden rounded-3xl transition-all duration-500",
        "border backdrop-blur-sm",
        isActive
          ? "border-white/15 scale-[1.01]"
          : isDimmed
            ? "border-white/5 scale-[0.99] opacity-60"
            : "border-white/8"
      )}
      style={{
        opacity: inView ? (isDimmed ? 0.55 : 1) : 0,
        transform: inView ? undefined : "translateY(30px)",
        transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)",
        transitionDelay: inView ? `${delay}ms` : "0ms",
        minHeight: 520,
      }}
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: isActive
            ? `radial-gradient(ellipse 80% 70% at ${side === "left" ? "25% 30%" : "75% 30%"}, ${data.accent}14, transparent 70%), linear-gradient(175deg, rgba(14,14,16,0.95) 0%, rgba(10,10,12,0.98) 100%)`
            : "linear-gradient(175deg, rgba(14,14,16,0.8) 0%, rgba(10,10,12,0.95) 100%)",
        }}
      />

      {/* Floating accent blur */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none transition-all duration-1000"
        style={{
          width: 300,
          height: 300,
          borderRadius: "50%",
          top: side === "left" ? "-80px" : "auto",
          bottom: side === "right" ? "-80px" : "auto",
          left: side === "left" ? "-60px" : "auto",
          right: side === "right" ? "-60px" : "auto",
          background: `radial-gradient(circle, ${data.accent}${isActive ? "1a" : "08"} 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-8 sm:p-12 flex flex-col h-full">
        {/* Top: emoji + tag */}
        <div className="flex items-start justify-between mb-10">
          <div
            className="text-4xl transition-transform duration-500"
            style={{
              transform: isActive ? "scale(1.15)" : "scale(1)",
              filter: isActive ? `drop-shadow(0 0 20px ${data.accent}50)` : "none",
            }}
          >
            {data.emoji}
          </div>
          <span
            className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border transition-all duration-500"
            style={{
              color: isActive ? data.accent : "rgba(255,255,255,0.3)",
              borderColor: isActive ? `${data.accent}40` : "rgba(255,255,255,0.08)",
              backgroundColor: isActive ? `${data.accent}0a` : "transparent",
            }}
          >
            {data.role}
          </span>
        </div>

        {/* Name */}
        <h3
          className="text-5xl sm:text-6xl font-bold tracking-tight leading-none mb-3 transition-all duration-500"
          style={{
            fontFamily: "var(--font-outfit, sans-serif)",
            letterSpacing: "-0.03em",
            color: isActive ? data.accent : "rgba(255,255,255,0.45)",
          }}
        >
          {data.name}
        </h3>

        {/* Question */}
        <p
          className="text-lg sm:text-xl italic text-white/30 mb-6 transition-colors duration-500"
          style={{
            color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
          }}
        >
          &ldquo;{data.question}&rdquo;
        </p>

        {/* Description */}
        <p
          className="text-sm text-white/40 leading-relaxed mb-8 max-w-sm transition-colors duration-500"
          style={{ color: isActive ? "rgba(255,255,255,0.55)" : undefined }}
        >
          {data.desc}
        </p>

        {/* Capabilities */}
        <div className="mt-auto space-y-2.5">
          {data.capabilities.map((cap, i) => (
            <div
              key={cap}
              className="flex items-center gap-3 transition-all duration-500"
              style={{
                opacity: isActive ? 1 : isDimmed ? 0.2 : 0.4,
                transform: isActive ? "translateX(4px)" : "translateX(0)",
                transitionDelay: isActive ? `${i * 50}ms` : "0ms",
              }}
            >
              <span
                className="h-[3px] rounded-full shrink-0 transition-all duration-500"
                style={{
                  width: isActive ? 20 : 8,
                  backgroundColor: isActive ? data.accent : "rgba(255,255,255,0.15)",
                }}
              />
              <span className="text-[13px] text-white/60 tracking-tight">{cap}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom edge glow */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 inset-x-0 h-px transition-opacity duration-700"
        style={{
          opacity: isActive ? 0.6 : 0,
          background: `linear-gradient(90deg, transparent 10%, ${data.accent}80 50%, transparent 90%)`,
        }}
      />
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function SomeThingSection() {
  const { ref, inView } = useInView(0.08)
  const [hovered, setHovered] = useState<"left" | "right" | null>(null)

  return (
    <section
      id="duo"
      ref={ref}
      className="relative mx-auto max-w-6xl px-6 sm:px-8 py-28 sm:py-40"
    >
      {/* Section header */}
      <div
        className="mb-20 max-w-2xl transition-all duration-700"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/25 mb-5">
          The minds behind Something
        </p>
        <h2
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.02]"
          style={{ fontFamily: "var(--font-outfit, sans-serif)", letterSpacing: "-0.03em" }}
        >
          Every idea deserves
          <br />
          <span className="text-white/25">both doubt and belief.</span>
        </h2>
        <p className="mt-6 text-white/40 text-base sm:text-lg leading-relaxed max-w-lg">
          <span style={{ color: NOTHING.accent }}>Nothing</span> tears your idea apart so the market
          doesn&apos;t.{" "}
          <span style={{ color: SOMETHING.accent }}>Something</span> finds why people will
          care. Together, they become your unfair advantage.
        </p>
      </div>

      {/* Dual cards */}
      <div className="grid lg:grid-cols-2 gap-5">
        <PersonaCard
          data={NOTHING}
          side="left"
          hovered={hovered}
          onHover={setHovered}
          inView={inView}
          delay={100}
        />
        <PersonaCard
          data={SOMETHING}
          side="right"
          hovered={hovered}
          onHover={setHovered}
          inView={inView}
          delay={220}
        />
      </div>

      {/* Bridge */}
      <div className="mt-14">
        <AnimatedMerge inView={inView} />
      </div>
    </section>
  )
}
