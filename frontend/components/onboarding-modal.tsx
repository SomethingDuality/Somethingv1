"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
  X,
  ArrowRight,
  Sparkles,
  Search,
  MessageSquare,
  User,
  Lightbulb,
  Shield,
  TrendingUp,
  Star,
  BrainCircuit,
  Eye,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface OnboardingStep {
  id: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  title: string
  body: string
  cta?: { label: string; href: string }
  highlight?: string
}

// ── Step definitions ──────────────────────────────────────────────────────────

function getFounderSteps(name: string, plan: string): OnboardingStep[] {
  return [
    {
      id: "welcome",
      icon: Star,
      iconBg: "rgba(52,211,153,0.08)",
      iconColor: "#34D399",
      title: `Welcome, ${name || "Founder"}.`,
      body: "You're in the network. Something is a platform where ideas are protected by default — every project ships with a mutual NDA before any details are shared.",
      highlight: "Your ideas are encrypted and private until you choose to share.",
    },
    {
      id: "post-idea",
      icon: Lightbulb,
      iconBg: "rgba(52,211,153,0.06)",
      iconColor: "#34D399",
      title: "Post your first idea.",
      body: "Your idea feed is your public signal to investors. Post what you're building, the problem you're solving, and what you're looking for. Keep it real — not a pitch deck.",
      cta: { label: "Post an idea →", href: "/founder/ideas" },
      highlight: "Investors browse ideas anonymously by default.",
    },
    {
      id: "meet-ai",
      icon: BrainCircuit,
      iconBg: "rgba(167,139,250,0.06)",
      iconColor: "#a78bfa",
      title: "Meet Something & Nothing.",
      body: "Two AI minds that co-pilot your startup. Nothing tears apart your assumptions. Something maps why users will actually stay. Use Mutiny to stress-test your next move before you pitch.",
      cta: { label: "Open Mutiny →", href: "/founder/mutiny" },
      highlight: plan === "free" ? "Upgrade to unlock unlimited AI queries." : "You have full AI access on your plan.",
    },
    {
      id: "complete-profile",
      icon: User,
      iconBg: "rgba(52,211,153,0.06)",
      iconColor: "#34D399",
      title: "Complete your profile.",
      body: "Investors who check your profile convert at 3× the rate of those who don't. Add your avatar, a short bio, and your social links. It takes two minutes.",
      cta: { label: "Edit profile →", href: "/founder/settings" },
    },
  ]
}

function getInvestorSteps(name: string, plan: string): OnboardingStep[] {
  return [
    {
      id: "welcome",
      icon: TrendingUp,
      iconBg: "rgba(227,194,122,0.08)",
      iconColor: "#E3C27A",
      title: `Welcome, ${name || "Investor"}.`,
      body: "You're in. Something gives you access to founders building real things — no deck spam, no cold outreach. Every deal is milestone-gated with escrow by default.",
      highlight: "Founders can't see who viewed their profile unless you initiate contact.",
    },
    {
      id: "find-deals",
      icon: Search,
      iconBg: "rgba(227,194,122,0.06)",
      iconColor: "#E3C27A",
      title: "Find your first deal.",
      body: "Search across all active founders by domain, stage, location, and trust score. Filter by what matters to you. Every startup card shows verified milestone history — not just promises.",
      cta: { label: "Browse startups →", href: "/investor/search" },
    },
    {
      id: "ghost-mode",
      icon: Eye,
      iconBg: "rgba(167,139,250,0.06)",
      iconColor: "#a78bfa",
      title: "You're invisible by default.",
      body: "Ghost Mode is on by default. Founders won't know you viewed their profile until you choose to initiate contact or send a message. Browse freely, commit carefully.",
      highlight: plan === "free" ? "Upgrade to Nothing to unlock full Ghost Mode controls." : "Ghost Mode is fully active on your plan.",
    },
    {
      id: "complete-profile",
      icon: Shield,
      iconBg: "rgba(227,194,122,0.06)",
      iconColor: "#E3C27A",
      title: "Build your investor identity.",
      body: "Founders check who's reaching out. Add your firm, investment thesis, and stage focus to your profile so the right founders respond to your messages.",
      cta: { label: "Set up profile →", href: "/investor/profile" },
    },
  ]
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  role: "founder" | "investor"
  plan: string
  userName: string
}

export function OnboardingModal({ role, plan, userName }: OnboardingModalProps) {
  const [visible, setVisible] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [direction, setDirection] = useState<"forward" | "back">("forward")

  const steps = role === "founder"
    ? getFounderSteps(userName, plan)
    : getInvestorSteps(userName, plan)

  const accentColor = role === "founder" ? "#34D399" : "#E3C27A"
  const currentStep = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1

  useEffect(() => {
    // Only show if onboarding hasn't been completed yet
    const done = localStorage.getItem("onboarding_complete")
    if (!done) {
      // Small delay so the dashboard renders first
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem("onboarding_complete", "1")
    setVisible(false)
  }

  const next = () => {
    if (isLast) {
      dismiss()
      return
    }
    setDirection("forward")
    setStepIdx((i) => i + 1)
  }

  const prev = () => {
    if (stepIdx === 0) return
    setDirection("back")
    setStepIdx((i) => i - 1)
  }

  const slideVariants = {
    enter: (dir: string) => ({
      x: dir === "forward" ? 32 : -32,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: string) => ({
      x: dir === "forward" ? -32 : 32,
      opacity: 0,
    }),
  }

  const Icon = currentStep.icon

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal Container */}
          <div
            className="fixed z-[101] w-full max-w-[480px] p-4"
            style={{
              top: "50vh",
              left: "50vw",
              transform: "translate(-50%, -50%)"
            }}
          >
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative w-full rounded-2xl border border-white/[0.08] bg-[#0d0e11] shadow-2xl overflow-hidden">

              {/* Top glow line */}
              <div
                aria-hidden
                className="absolute top-0 inset-x-0 h-px"
                style={{
                  background: `linear-gradient(to right, transparent, ${accentColor}50, transparent)`,
                }}
              />

              {/* Ambient glow blob */}
              <div
                className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${accentColor}06 0%, transparent 70%)`,
                }}
              />

              {/* Close button */}
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 z-10 h-8 w-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                aria-label="Skip onboarding"
                id="onboarding-close-btn"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Content area */}
              <div className="p-8 pb-6">

                {/* Step progress dots */}
                <div className="flex items-center gap-1.5 mb-8">
                  {steps.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setDirection(i > stepIdx ? "forward" : "back")
                        setStepIdx(i)
                      }}
                      className="transition-all duration-300 rounded-full cursor-pointer"
                      style={{
                        height: 4,
                        width: i === stepIdx ? 24 : 8,
                        background: i === stepIdx
                          ? accentColor
                          : i < stepIdx
                          ? `${accentColor}40`
                          : "rgba(255,255,255,0.08)",
                      }}
                      aria-label={`Go to step ${i + 1}`}
                    />
                  ))}
                  <span className="ml-auto text-[10px] font-mono text-white/25">
                    {stepIdx + 1} / {steps.length}
                  </span>
                </div>

                {/* Animated step content */}
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentStep.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-5"
                  >
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: currentStep.iconBg,
                        border: `1px solid ${currentStep.iconColor}20`,
                        color: currentStep.iconColor,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Title */}
                    <h2
                      className="text-2xl font-bold tracking-tight leading-tight"
                      style={{ fontFamily: "var(--font-outfit)" }}
                    >
                      {currentStep.title}
                    </h2>

                    {/* Body */}
                    <p className="text-sm text-white/50 leading-relaxed">
                      {currentStep.body}
                    </p>

                    {/* Highlight callout */}
                    {currentStep.highlight && (
                      <div
                        className="flex items-start gap-2.5 rounded-xl p-3.5"
                        style={{
                          background: `${accentColor}06`,
                          border: `1px solid ${accentColor}18`,
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                        <p className="text-xs leading-relaxed" style={{ color: `${accentColor}cc` }}>
                          {currentStep.highlight}
                        </p>
                      </div>
                    )}

                    {/* CTA link */}
                    {currentStep.cta && (
                      <Link
                        href={currentStep.cta.href}
                        onClick={dismiss}
                        className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                        style={{ color: accentColor }}
                        id={`onboarding-cta-${currentStep.id}`}
                      >
                        {currentStep.cta.label}
                      </Link>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer controls */}
              <div className="flex items-center justify-between px-8 py-5 border-t border-white/[0.05]">
                <button
                  onClick={prev}
                  disabled={stepIdx === 0}
                  className={cn(
                    "text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer",
                    stepIdx === 0 && "opacity-0 pointer-events-none"
                  )}
                  id="onboarding-prev-btn"
                >
                  ← Back
                </button>

                <button
                  onClick={dismiss}
                  className="text-xs text-white/20 hover:text-white/40 transition-colors cursor-pointer"
                  id="onboarding-skip-btn"
                >
                  Skip all
                </button>

                <button
                  onClick={next}
                  className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-5 py-2 transition-all hover:opacity-90 cursor-pointer text-black"
                  style={{ background: accentColor }}
                  id="onboarding-next-btn"
                >
                  {isLast ? (
                    <>Let&apos;s go</>
                  ) : (
                    <>Next <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        </>
      )}
    </AnimatePresence>
  )
}
