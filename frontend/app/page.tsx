"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, useInView, useScroll, useTransform } from "framer-motion"
import Image from "next/image"
import { NavAvant } from "@/components/nav-avant"
import { LandingBg } from "@/components/landing-bg"
import { ActionPicker } from "@/components/action-picker"
import { cn } from "@/lib/utils"
import { Users, Coins, Lightbulb } from "lucide-react"

// ─── HERO — centered, editorial, typographic ─────────────────────────────────
// No left/right split. No orbs. The headline IS the visual.
function HeroSection({ onCTA }: { onCTA: () => void }) {
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0])
  const heroY = useTransform(scrollY, [0, 600], [0, -80])

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <motion.div
        className="text-center max-w-4xl mx-auto flex flex-col items-center"
        style={{ opacity: heroOpacity, y: heroY }}
      >
        {/* Tiny floating mascot above headline */}
        <motion.div
          className="mb-6 flex justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: [0, -6, 0]
          }}
          transition={{
            opacity: { duration: 0.8, delay: 0.1 },
            scale: { duration: 0.8, delay: 0.1 },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <div className="relative h-12 w-12 opacity-40 hover:opacity-70 transition-opacity duration-700">
            <Image
              src="/thing-logo.png"
              alt="Thing"
              fill
              className="object-contain invert"
              sizes="48px"
              priority
            />
          </div>
        </motion.div>

        {/* Headline — the word "something" IS the show */}
        <motion.h1
          className="text-white/50 text-lg sm:text-xl font-normal tracking-tight mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          you&apos;re working on
        </motion.h1>

        <motion.h2
          className="text-7xl sm:text-8xl lg:text-[10rem] font-bold tracking-tighter leading-[0.85]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontFamily: "var(--font-outfit)", letterSpacing: "-0.05em" }}
        >
          something
          <span className="text-white/15">.</span>
        </motion.h2>

        {/* Sub copy — clear value proposition */}
        <motion.p
          className="mt-10 text-white/70 text-sm sm:text-base leading-relaxed max-w-xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
        >
          Most ideas die quietly — in someone&apos;s head, without a team, or in a cold inbox. Something won&apos;t let yours. Two AI agents argue over it first. One tries to kill it. If it survives, the <span className="text-[#E3C27A] font-semibold">right people</span> find you.
        </motion.p>

        {/* CTA */}
        <motion.div
          className="mt-10 flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          <motion.button
            onClick={onCTA}
            className="rounded-full px-10 py-4 text-sm font-semibold text-[#0a0a0c] bg-white cursor-pointer"
            whileHover={{
              backgroundColor: "#E3C27A",
              boxShadow: "0 0 60px rgba(227,194,122,0.3)",
              scale: 1.04,
            }}
            whileTap={{ scale: 0.96 }}
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset, 0 4px 20px rgba(0,0,0,0.4)" }}
          >
            Get started →
          </motion.button>
          <span className="text-[11px] text-white/60 tracking-wide">
            private by default · verified proof-of-work · zero lock-in
          </span>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <motion.div
          className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent mx-auto"
          animate={{ scaleY: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </section>
  )
}

// ─── NOTHING & SOMETHING — full-width dramatic split ─────────────────────────
// Each side fills half the viewport. Hovering one dims the other.
function DualSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })
  const [active, setActive] = useState<"nothing" | "something" | null>(null)

  const sides = [
    {
      id: "nothing" as const,
      name: "Nothing",
      accent: "#E3C27A",
      question: "What breaks this idea?",
      desc: "When someone hears your idea and their face goes blank — that's Nothing. The hard questions. The investor lens. The daylight test that kills what shouldn't survive.",
      traits: ["Business model flaws", "Competition risks", "Timing issues", "Worst-case scenarios"],
    },
    {
      id: "something" as const,
      name: "Something",
      accent: "#34D399",
      question: "What makes people stay?",
      desc: "When someone hears your idea and leans in — that's Something. The supporter who finds why users care, why they stay, and how you build a real community.",
      traits: ["User delight", "Core value loop", "Community fit", "Viral loops"],
    },
  ]

  return (
    <section id="duo" ref={ref} className="relative">
      {/* Section intro — full width centered */}
      <div className="mx-auto max-w-6xl px-6 sm:px-8 pt-28 sm:pt-40 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[0.95]"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            every idea deserves
            <br />
            <span className="text-white/15">both doubt and belief.</span>
          </h2>
        </motion.div>
      </div>

      {/* The split — full bleed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[70vh]">
        {sides.map((s, i) => {
          const isActive = active === s.id
          const isDimmed = active !== null && !isActive

          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: i === 0 ? -40 : 40 }}
              animate={inView ? { opacity: isDimmed ? 0.3 : 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => setActive(s.id)}
              onMouseLeave={() => setActive(null)}
              className="relative flex flex-col justify-center px-10 sm:px-16 lg:px-20 py-20 cursor-default transition-all duration-700 overflow-hidden"
              style={{
                borderRight: i === 0 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}
            >
              {/* Ambient background shift */}
              <div
                aria-hidden
                className="absolute inset-0 transition-opacity duration-1000 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 60% 50% at ${i === 0 ? "70% 40%" : "30% 60%"}, ${s.accent}${isActive ? "0c" : "03"}, transparent 70%)`,
                }}
              />

              <div className="relative z-10 max-w-md">
                <h3
                  className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-none mb-4 transition-colors duration-700"
                  style={{
                    fontFamily: "var(--font-outfit)",
                    color: isActive ? s.accent : "rgba(255,255,255,0.2)",
                  }}
                >
                  {s.name}
                </h3>

                <p
                  className="text-xl italic transition-colors duration-700 mb-6"
                  style={{ color: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)" }}
                >
                  &ldquo;{s.question}&rdquo;
                </p>

                <p
                  className="text-sm leading-relaxed mb-10 transition-colors duration-700"
                  style={{ color: isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)" }}
                >
                  {s.desc}
                </p>

                {/* Traits — horizontal pills */}
                <div className="flex flex-wrap gap-2">
                  {s.traits.map((t, ti) => (
                    <span
                      key={t}
                      className="text-[11px] tracking-wide rounded-full px-3 py-1 border transition-all duration-500"
                      style={{
                        borderColor: isActive ? `${s.accent}30` : "rgba(255,255,255,0.05)",
                        color: isActive ? `${s.accent}` : "rgba(255,255,255,0.2)",
                        backgroundColor: isActive ? `${s.accent}08` : "transparent",
                        transitionDelay: isActive ? `${ti * 40}ms` : "0ms",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Edge glow */}
              <div
                aria-hidden
                className="absolute bottom-0 inset-x-0 h-px transition-opacity duration-700"
                style={{
                  opacity: isActive ? 0.4 : 0,
                  background: `linear-gradient(90deg, transparent 5%, ${s.accent}60 50%, transparent 95%)`,
                }}
              />
            </motion.div>
          )
        })}
      </div>

      {/* Merge line */}
      <div className="flex items-center justify-center py-14 gap-4">
        <span className="text-xs font-medium tracking-tight" style={{ color: "#E3C27A" }}>Nothing</span>
        <span className="h-px w-16 bg-gradient-to-r from-[#E3C27A]/30 via-[#F472B6]/20 to-[#34D399]/30" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/45 border border-white/15 rounded-full px-4 py-1">becomes</span>
        <span className="h-px w-16 bg-gradient-to-r from-[#34D399]/30 via-[#F472B6]/20 to-[#E3C27A]/30" />
        <span className="text-xs font-medium tracking-tight" style={{ color: "#34D399" }}>Something</span>
      </div>
    </section>
  )
}

// ─── HOW IT WORKS — horizontal scroll ticker + vertical reveal ───────────────
function HowSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const flow = [
    { step: "01", label: "Share your idea", detail: "Protected by mutual NDAs and private access logs. Your IP remains yours, fully documented from day one.", accent: "#E3C27A" },
    { step: "02", label: "Nothing tears it apart", detail: "The AI acts like a skeptical investor, pointing out exactly where your business model, timing, or market entry will fail.", accent: "#E3C27A" },
    { step: "03", label: "Something finds the heart", detail: "The AI helps find the core value — who needs this most, why they will love it, and why they won't leave.", accent: "#34D399" },
    { step: "04", label: "Find your people", detail: "Get matched with co-founders, builders, and investors who actually care about the problem you're solving.", accent: "#F472B6" },
    { step: "05", label: "Fund transparently", detail: "Safe milestone payments. Funds are locked and only released when the team finishes and verifies each step of the project.", accent: "#34D399" },
  ]

  return (
    <section ref={ref} className="py-28 sm:py-40" id="how">
      {/* Marquee ticker */}
      <div className="overflow-hidden mb-20 opacity-[0.2]">
        <motion.div
          className="flex whitespace-nowrap gap-12 text-6xl sm:text-7xl font-bold tracking-tighter"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="flex gap-12">
              <span>share</span>
              <span className="text-[#E3C27A]">·</span>
              <span>challenge</span>
              <span className="text-[#34D399]">·</span>
              <span>believe</span>
              <span className="text-[#F472B6]">·</span>
              <span>match</span>
              <span className="text-[#E3C27A]">·</span>
              <span>fund</span>
              <span className="text-white/30">·</span>
            </span>
          ))}
        </motion.div>
      </div>

      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-3xl sm:text-4xl font-bold tracking-tighter mb-16 text-center"
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          from hidden idea<span className="text-white/45"> to funded company</span>
        </motion.h2>

        {/* Steps — minimal timeline */}
        <div className="space-y-0">
          {flow.map((f, i) => (
            <motion.div
              key={f.step}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.6 }}
              className="group grid grid-cols-[48px_1fr] sm:grid-cols-[64px_1fr] gap-x-4 sm:gap-x-8 items-start py-8 border-b border-white/[0.03] hover:border-white/[0.07] transition-all duration-500"
            >
              {/* Number */}
              <span
                className="text-xs font-mono pt-1 transition-colors duration-500"
                style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-outfit)" }}
              >
                {f.step}
              </span>

              {/* Title & Description */}
              <div className="space-y-1">
                <h3
                  className="text-base sm:text-lg font-semibold tracking-tight text-white/60 group-hover:text-white/90 transition-colors duration-500"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  {f.label}
                </h3>
                <p className="text-xs sm:text-sm text-white/50 group-hover:text-white/75 leading-relaxed transition-colors duration-500 max-w-xl">
                  {f.detail}
                </p>
              </div>

              {/* Hover accent */}
              <div
                aria-hidden
                className="col-span-full h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 mt-8"
                style={{ background: `linear-gradient(90deg, ${f.accent}20, transparent 60%)` }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── COMMUNITY FUNDING — clean, data-forward ─────────────────────────────────
// In v1 this is community funding
function FundingSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const milestones = [
    { name: "Engineering M1", amount: 8000, pct: 37, status: "Released", color: "#34D399", receiptId: "rec-7a24" },
    { name: "Design sprints", amount: 2200, pct: 10, status: "Released", color: "#E3C27A", receiptId: "rec-8ef1" },
    { name: "Cloud credits", amount: 900, pct: 4, status: "Released", color: "#F472B6", receiptId: "rec-3b58" },
    { name: "Engineering M2", amount: 10000, pct: 46, status: "In progress", color: "#818CF8", details: "Voting ends in 2 days" },
    { name: "Ops & admin", amount: 700, pct: 3, status: "Pending", color: "rgba(255,255,255,0.2)", details: "Locked until milestone 3" },
  ]

  return (
    <section ref={ref} id="funding" className="mx-auto max-w-5xl px-6 sm:px-8 py-28 sm:py-40">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
        className="text-center mb-16"
      >
        <h2
          className="text-3xl sm:text-4xl font-bold tracking-tighter"
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          every dollar visible<span className="text-white/15">.</span>
        </h2>
        <p className="mt-4 text-white/60 text-sm max-w-md mx-auto leading-relaxed">
          Milestone-locked payments. Clear tracking. No hidden fees or black boxes.
        </p>
      </motion.div>

      {/* Escrow Status Summary Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.15 }}
        className="mx-auto max-w-md mb-10 flex items-center justify-between px-4 py-2.5 rounded-full border border-white/5 bg-white/[0.01] backdrop-blur-sm text-xs text-white/60"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-white/70">Secure Escrow Account</span>
          <span className="text-white/15">·</span>
          <span className="font-mono text-white/55">waitlist-vault-01</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-white/70">
          <span>Escrow:</span>
          <span className="text-[#34D399] font-semibold">$10,700</span>
          <span className="text-white/30">/</span>
          <span>$21,800</span>
        </div>
      </motion.div>

      {/* Stacked horizontal bars — each milestone is a proportional bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.25 }}
        className="mb-12"
      >
        {/* Combined bar */}
        <div className="flex h-4 rounded-full overflow-hidden gap-0.5 bg-white/[0.02] p-1 border border-white/5 backdrop-blur-sm">
          {milestones.map((m, i) => {
            const isHovered = hoveredIdx === i
            const isDimmed = hoveredIdx !== null && hoveredIdx !== i

            return (
              <motion.div
                key={m.name}
                className="h-full rounded-full cursor-pointer relative"
                style={{
                  backgroundColor: m.color,
                  boxShadow: isHovered ? `0 0 15px ${m.color}cc` : "none",
                  zIndex: isHovered ? 10 : 1,
                }}
                initial={{ width: 0 }}
                animate={inView ? {
                  width: `${m.pct}%`,
                  opacity: isDimmed ? 0.35 : 1,
                  scaleY: isHovered ? 1.15 : 1
                } : {}}
                transition={{
                  width: { duration: 0.8, delay: 0.4 + i * 0.08, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.2 },
                  scaleY: { duration: 0.2 }
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            )
          })}
        </div>
        <div className="flex justify-between mt-3 text-[11px] text-white/45 font-mono">
          <span>Escrow initialized ($0)</span>
          <span className="hidden sm:inline">Released: $11,100</span>
          <span>Target pool ($21,800)</span>
        </div>
      </motion.div>

      {/* Milestone rows */}
      <div className="space-y-1 relative">
        {milestones.map((m, i) => {
          const isHovered = hoveredIdx === i
          const isDimmed = hoveredIdx !== null && hoveredIdx !== i

          return (
            <motion.div
              key={m.name}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: isDimmed ? 0.45 : 1 } : {}}
              transition={{ delay: 0.45 + i * 0.06 }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="flex items-center justify-between py-3.5 px-4 rounded-xl border border-transparent transition-all duration-300 cursor-pointer"
              style={{
                backgroundColor: isHovered ? "rgba(255, 255, 255, 0.02)" : "transparent",
                borderColor: isHovered ? "rgba(255, 255, 255, 0.04)" : "transparent",
                boxShadow: isHovered ? "inset 0 0 12px rgba(255, 255, 255, 0.01)" : "none",
              }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="h-2 w-2 rounded-full shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor: m.color,
                    transform: isHovered ? "scale(1.25)" : "scale(1)",
                    boxShadow: isHovered ? `0 0 10px ${m.color}` : "none",
                  }}
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-sm font-medium transition-colors" style={{ color: isHovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)" }}>
                    {m.name}
                  </span>
                  {m.receiptId && (
                    <span className="text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors">
                      {m.receiptId}
                    </span>
                  )}
                  {isHovered && m.details && (
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[11px] text-white/45 font-mono"
                    >
                      {m.details}
                    </motion.span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span
                  className={cn(
                    "text-[11px] font-mono tracking-wide uppercase px-2.5 py-0.5 rounded border transition-colors duration-300",
                    m.status === "Released" && "text-emerald-400/80 bg-emerald-500/5 border-emerald-500/10",
                    m.status === "In progress" && "text-indigo-400/80 bg-indigo-500/5 border-indigo-500/10",
                    m.status === "Pending" && "text-white/45 bg-white/5 border-white/8"
                  )}
                >
                  {m.status}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums tracking-tight transition-colors duration-300"
                  style={{
                    fontFamily: "var(--font-outfit)",
                    color: isHovered ? m.color : "rgba(255,255,255,0.65)"
                  }}
                >
                  ${m.amount.toLocaleString()}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.9 }}
        className="mt-10 text-center text-[11px] text-white/45 tracking-widest uppercase font-mono"
      >
        secure escrow account · milestone verification · clear receipts
      </motion.p>
    </section>
  )
}

// ─── FOOTER — minimal ───────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="relative border-t border-white/[0.03]">
      <div aria-hidden className="absolute inset-x-0 h-px" style={{
        background: "linear-gradient(90deg, transparent, rgba(227,194,122,0.15) 30%, rgba(52,211,153,0.15) 70%, transparent)",
      }} />
      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-16">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-10">
          <div>
            <p className="font-semibold tracking-tight mb-2" style={{ fontFamily: "var(--font-outfit)" }}>Something</p>
            <p className="text-white/45 text-xs">somewhere between conviction and doubt.</p>
          </div>
          <div className="flex flex-wrap gap-12 sm:gap-16 text-[13px]">
            <div className="space-y-2">
              <p className="text-white/40 text-[11px] uppercase tracking-[0.2em] mb-3">Product</p>
              <a href="#duo" className="block text-white/50 hover:text-white/80 transition-colors">The Framework</a>
              <a href="#how" className="block text-white/50 hover:text-white/80 transition-colors">How it works</a>
              <a href="#funding" className="block text-white/50 hover:text-white/80 transition-colors">Funding</a>
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-[11px] uppercase tracking-[0.2em] mb-3">Legal</p>
              <a href="/terms" className="block text-white/50 hover:text-white/80 transition-colors">Terms</a>
              <a href="/terms" className="block text-white/50 hover:text-white/80 transition-colors">Privacy</a>
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-[11px] uppercase tracking-[0.2em] mb-3">Contact</p>
              <a href="mailto:somethingduality09@gmail.com" className="block text-white/50 hover:text-white/80 transition-colors font-mono text-[12px]">
                somethingduality09@gmail.com
              </a>
            </div>
          </div>
        </div>
        <div className="mt-14 pt-5 border-t border-white/[0.02] flex justify-between">
          <p className="text-[11px] text-white/35">© {new Date().getFullYear()} Something.</p>
          <p className="text-[11px] text-white/35 italic">ideas find their people.</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8">
      <div className="h-px w-full opacity-10" style={{
        background: "linear-gradient(90deg, transparent 0%, #E3C27A 30%, #34D399 70%, transparent 100%)",
      }} />
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function Page() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const router = useRouter()

  // Prefetch /signup as soon as the homepage mounts so navigation is instant
  useEffect(() => {
    router.prefetch("/signup")
  }, [router])

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-white relative" style={{ zIndex: 1 }}>
      <LandingBg />
      <NavAvant />

      <HeroSection onCTA={() => setPickerOpen(true)} />
      <ActionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <Divider />
      <DualSection />
      <Divider />
      <HowSection />
      <Divider />
      <FundingSection />
      <Footer />
    </main>
  )
}
