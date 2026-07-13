"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import apiClient from "@/lib/axios"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SomethingLogo } from "@/components/something-logo"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  User,
  Award,
  Compass,
  Briefcase,
  Link2,
  DollarSign,
  Loader2,
  UserCheck,
  Eye,
  EyeOff,
  Check,
  Sparkles,
  Zap,
  Crown,
} from "lucide-react"

// ── Constants ──────────────────────────────────────────────────────────────────

const FOUNDER_EXPERTISE_OPTS = [
  "Product", "Engineering", "Design", "Growth/Marketing",
  "Finance", "Legal", "Operations", "Hardware", "AI/ML",
]

const INVESTOR_INTEREST_OPTS = [
  "Pre-seed", "Seed", "Series A", "Web3",
  "AI/ML", "Climate", "Health", "Fintech", "Consumer", "Deep Tech",
]

// ── Plan definitions ──────────────────────────────────────────────────────────

const FOUNDER_PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "Start with the basics",
    icon: null,
    price: "Free",
    color: "white",
    accentClass: "border-white/10 hover:border-white/20",
    selectedClass: "border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.05)]",
    features: ["Post 1 idea", "Basic AI validation (5 queries/mo)", "3 investor chats/month", "Public profile"],
    disabled: false,
  },
  {
    key: "something",
    name: "Something",
    tagline: "Build with conviction",
    icon: Sparkles,
    price: "$29/mo",
    color: "#34D399",
    accentClass: "border-[#34D399]/20 hover:border-[#34D399]/40",
    selectedClass: "border-[#34D399] shadow-[0_0_30px_rgba(52,211,153,0.12)]",
    features: [
      "Unlimited ideas",
      "Full Something + Nothing AI",
      "Milestone tracking & escrow",
      "NDA stack per deal",
      "Unlimited chats",
      "Analytics dashboard",
    ],
    recommended: true,
    disabled: false,
  },
  {
    key: "something_pro",
    name: "Something Pro",
    tagline: "For serious builders",
    icon: Crown,
    price: "$79/mo",
    color: "#a78bfa",
    accentClass: "border-[#a78bfa]/20 hover:border-[#a78bfa]/40",
    selectedClass: "border-[#a78bfa] shadow-[0_0_30px_rgba(167,139,250,0.12)]",
    features: [
      "Everything in Something",
      "Priority investor matching",
      "Problems board early access",
      "Co-founder radar",
      "Custom AI persona tuning",
    ],
    disabled: false,
  },
]

const INVESTOR_PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "Dip your toes in",
    icon: null,
    price: "Free",
    color: "white",
    accentClass: "border-white/10 hover:border-white/20",
    selectedClass: "border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.05)]",
    features: ["Browse public ideas", "3 founder chats/month", "Basic search filters"],
    disabled: false,
  },
  {
    key: "nothing",
    name: "Nothing",
    tagline: "Invest with clarity",
    icon: Zap,
    price: "$49/mo",
    color: "#E3C27A",
    accentClass: "border-[#E3C27A]/20 hover:border-[#E3C27A]/40",
    selectedClass: "border-[#E3C27A] shadow-[0_0_30px_rgba(227,194,122,0.12)]",
    features: [
      "Full startup search",
      "Ghost Mode browsing",
      "Bookmark & watchlist",
      "AI diligence assistant",
      "Unlimited chats",
      "NDA request tools",
    ],
    recommended: true,
    disabled: false,
  },
  {
    key: "nothing_pro",
    name: "Nothing Pro",
    tagline: "Lead the deal",
    icon: Crown,
    price: "$129/mo",
    color: "#f59e0b",
    accentClass: "border-[#f59e0b]/20 hover:border-[#f59e0b]/40",
    selectedClass: "border-[#f59e0b] shadow-[0_0_30px_rgba(245,158,11,0.12)]",
    features: [
      "Everything in Nothing",
      "Problems board access",
      "Portfolio analytics",
      "Early deal flow alerts",
      "Dedicated support",
    ],
    disabled: false,
  },
]

// ── Password strength ─────────────────────────────────────────────────────────

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: "Weak", color: "#ef4444" }
  if (score <= 2) return { score, label: "Fair", color: "#f59e0b" }
  if (score <= 3) return { score, label: "Good", color: "#34D399" }
  return { score, label: "Strong", color: "#34D399" }
}

// ── Sidebar copy per step ──────────────────────────────────────────────────────

const STEP_COPY = [
  {
    headline: "protect the idea.\nfind the conviction.",
    sub: "Two AI minds at your side. Nothing stress-tests reality. Something finds why people will stay.",
    accentWord: "conviction",
    accentColor: "#34D399",
  },
  {
    headline: "choose your\npath forward.",
    sub: "Every tier is built around transparency, not lock-in. You can change plans any time.",
    accentWord: "path",
    accentColor: "#34D399",
  },
  {
    headline: "your identity\nis yours.",
    sub: "NDAs are cryptographic defaults here. Your email and project details stay hashed until you consent.",
    accentWord: "yours",
    accentColor: "#34D399",
  },
  {
    headline: "one last thing\nbefore you go.",
    sub: "This data shapes how the AI finds your match — the more context, the sharper the signal.",
    accentWord: "sharper",
    accentColor: "#34D399",
  },
]

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()

  // Step state: 1=Role, 2=Plan, 3=Credentials, 4=Profile
  const [step, setStep] = useState(1)

  // Role & Plan
  const [role, setRole] = useState<"founder" | "investor">("founder")
  const [selectedPlan, setSelectedPlan] = useState("something")

  // Credentials
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [terms, setTerms] = useState(false)

  // Profile – Founder
  const [expertise, setExpertise] = useState<string[]>([])
  const [newExpertise, setNewExpertise] = useState("")
  const [experience, setExperience] = useState("")
  const [occupation, setOccupation] = useState("")
  const [linkedin, setLinkedin] = useState("")
  const [github, setGithub] = useState("")

  // Profile – Investor
  const [firm, setFirm] = useState("")
  const [investStage, setInvestStage] = useState("")
  const [interests, setInterests] = useState<string[]>([])
  const [newInterest, setNewInterest] = useState("")
  const [twitter, setTwitter] = useState("")

  // Shared
  const [age, setAge] = useState<number | "">("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Validation ──────────────────────────────────────────────────────────────

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordValid = password.length >= 8
  const passwordsMatch = password === confirm && confirm.length > 0
  const step3Valid = name.trim().length > 0 && emailValid && passwordValid && passwordsMatch && terms
  const step4Valid =
    role === "founder"
      ? expertise.length > 0
      : true // investor profile is optional

  const pwStrength = getPasswordStrength(password)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const plans = role === "founder" ? FOUNDER_PLANS : INVESTOR_PLANS
  const founderColor = "#34D399"
  const investorColor = "#E3C27A"
  const accentColor = role === "founder" ? founderColor : investorColor

  const goNext = () => setStep((s) => Math.min(s + 1, 4))
  const goBack = () => setStep((s) => Math.max(s - 1, 1))

  const toggleExpertise = (v: string) =>
    setExpertise((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))

  const toggleInterest = (v: string) =>
    setInterests((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))

  const addCustomExpertise = () => {
    const v = newExpertise.trim()
    if (v && !expertise.map((x) => x.toLowerCase()).includes(v.toLowerCase())) {
      setExpertise((p) => [...p, v])
    }
    setNewExpertise("")
  }

  const addCustomInterest = () => {
    const v = newInterest.trim()
    if (v && !interests.map((x) => x.toLowerCase()).includes(v.toLowerCase())) {
      setInterests((p) => [...p, v])
    }
    setNewInterest("")
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!step4Valid || loading) return
    setLoading(true)
    setError(null)

    const payload = {
      name:          name.trim(),
      email:         email.trim(),
      password,
      role,
      plan:          selectedPlan,
      accepted_terms: terms,
      // shared optional
      age:           age === "" ? undefined : age,
      linkedin:      linkedin   || undefined,
      // founder-only
      expertise:     role === "founder" ? (expertise.length ? expertise : undefined) : undefined,
      experience:    role === "founder" ? (experience  || undefined) : undefined,
      occupation:    role === "founder" ? (occupation  || undefined) : undefined,
      github:        role === "founder" ? (github      || undefined) : undefined,
      // investor-only
      firm:          role === "investor" ? (firm        || undefined) : undefined,
      interests:     role === "investor" ? (interests.length ? interests : undefined) : undefined,
      invest_stage:  role === "investor" ? (investStage || undefined) : undefined,
      twitter:       role === "investor" ? (twitter     || undefined) : undefined,
    }

    try {
      const res = await apiClient.post("/auth/signup", payload)

      const u = res.data?.user
      localStorage.removeItem("founder_profile_data")
      localStorage.removeItem("investor_profile_data")
      localStorage.removeItem("founder_milestones")
      localStorage.removeItem("investor_portfolio")
      localStorage.setItem("demo_name",     u?.name  ?? name.trim())
      localStorage.setItem("demo_email",    u?.email ?? email.trim())
      localStorage.setItem("demo_role",     u?.role  ?? role)
      localStorage.setItem("selected_plan", u?.plan  ?? selectedPlan)
      localStorage.removeItem("onboarding_complete")

      window.dispatchEvent(new Event("auth:login"))
      router.push(role === "investor" ? "/investor" : "/founder")
    } catch (err: unknown) {
      setError("Signup failed. Please check your details and try again.")
    } finally {
      setLoading(false)
    }
  }

  const copyIndex = Math.min(step - 1, STEP_COPY.length - 1)
  const copy = STEP_COPY[copyIndex]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0a0a0c] text-white">

      {/* ── Left brand column ── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-white/5 bg-[#070709] w-[440px] shrink-0">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute top-1/3 -left-1/3 w-[500px] h-[500px] rounded-full transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, ${accentColor}08 0%, transparent 65%)`,
          }}
        />
        <div
          className="pointer-events-none absolute bottom-1/4 right-0 w-64 h-64 rounded-full transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, ${accentColor}04 0%, transparent 70%)`,
          }}
        />

        {/* Logo */}
        <Link href="/" className="relative z-10">
          <SomethingLogo />
        </Link>

        {/* Editorial copy — changes per step */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45 }}
            className="relative z-10 space-y-5 my-auto"
          >
            <h2
              className="text-4xl font-bold tracking-tight leading-[1.15] whitespace-pre-line"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              {copy.headline.split(copy.accentWord).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span style={{ color: accentColor }}>{copy.accentWord}</span>
                  )}
                </span>
              ))}
            </h2>

            <p className="text-sm text-white/30 leading-relaxed max-w-[280px]">
              {copy.sub}
            </p>

            {/* Trust badges */}
            <div className="flex flex-col gap-2.5 pt-4">
              {[
                "Mutual NDAs by default",
                "Escrow-gated milestone releases",
                "Zero lock-in contracts",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2 text-[11px] text-white/25 font-mono">
                  <span
                    className="h-1 w-1 rounded-full shrink-0"
                    style={{ background: accentColor, opacity: 0.6 }}
                  />
                  {t}
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 flex justify-between text-[11px] text-white/20 font-mono">
          <span>something.to</span>
          <span>v2.0</span>
        </div>
      </div>

      {/* ── Right form column ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative overflow-hidden">
        {/* Mobile header */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Link href="/"><SomethingLogo /></Link>
        </div>

        <div className="w-full max-w-xl">
          {/* Card */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-xl shadow-2xl relative overflow-hidden">
            {/* Top glow line */}
            <div
              aria-hidden
              className="absolute top-0 inset-x-0 h-px transition-all duration-500"
              style={{
                background: `linear-gradient(to right, transparent, ${accentColor}40, transparent)`,
              }}
            />

            {/* Progress bar */}
            <div className="px-8 pt-7 pb-0">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest">
                  Step {step} of 4
                </span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        width: s === step ? 28 : 10,
                        background: s <= step ? accentColor : "rgba(255,255,255,0.06)",
                        opacity: s < step ? 0.4 : 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Step content */}
            <div className="px-8 pb-12 pt-2">
              <AnimatePresence mode="wait">

                {/* ── Step 1: Role ── */}
                {step === 1 && (
                  <motion.div
                    key="step-role"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-7"
                  >
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                        Choose your role
                      </h1>
                      <p className="mt-1.5 text-sm text-white/40">
                        Are you building something, or backing it?
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Founder */}
                      <button
                        type="button"
                        id="role-founder-btn"
                        onClick={() => { setRole("founder"); setSelectedPlan("something"); goNext() }}
                        className={cn(
                          "group relative rounded-xl border p-5 text-left cursor-pointer transition-all duration-300 flex flex-col justify-between min-h-[190px] w-full",
                          role === "founder"
                            ? "border-[#34D399]/60 bg-[#34D399]/[0.04] shadow-[0_0_24px_rgba(52,211,153,0.08)]"
                            : "border-white/8 bg-white/[0.01] hover:border-white/15 hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="space-y-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                            <span className="text-[#34D399] text-lg">◉</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold tracking-tight text-white">Founder</h3>
                            <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
                              You have an idea, a team, or a problem worth solving. Get funded transparently through milestone-gated escrow.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#34D399] text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity mt-3 shrink-0">
                          Select <ArrowRight className="h-2.5 w-2.5" />
                        </div>
                      </button>

                      {/* Investor */}
                      <button
                        type="button"
                        id="role-investor-btn"
                        onClick={() => { setRole("investor"); setSelectedPlan("nothing"); goNext() }}
                        className={cn(
                          "group relative rounded-xl border p-5 text-left cursor-pointer transition-all duration-300 flex flex-col justify-between min-h-[190px] w-full",
                          role === "investor"
                            ? "border-[#E3C27A]/60 bg-[#E3C27A]/[0.04] shadow-[0_0_24px_rgba(227,194,122,0.08)]"
                            : "border-white/8 bg-white/[0.01] hover:border-white/15 hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="space-y-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(227,194,122,0.08)", border: "1px solid rgba(227,194,122,0.2)" }}>
                            <span className="text-[#E3C27A] text-lg">◈</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold tracking-tight text-white">Investor</h3>
                            <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
                              You back early-conviction founders. Discover deals, run diligence with AI, and release funds by milestone.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#E3C27A] text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity mt-3 shrink-0">
                          Select <ArrowRight className="h-2.5 w-2.5" />
                        </div>
                      </button>
                    </div>

                    <p className="text-center text-xs text-white/30 mt-8 pb-4">
                      Already have an account?{" "}
                      <Link href="/login" className="text-white font-medium hover:underline">Sign in</Link>
                    </p>
                  </motion.div>
                )}

                {/* ── Step 2: Plan ── */}
                {step === 2 && (
                  <motion.div
                    key="step-plan"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-6"
                  >
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                        {role === "founder" ? "Pick your plan" : "How do you want to invest?"}
                      </h1>
                      <p className="mt-1.5 text-sm text-white/40">
                        {role === "founder"
                          ? "Start free or unlock the full AI-powered suite."
                          : "Browse for free or go deep with full diligence tools."}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {plans.map((plan) => {
                        const Icon = plan.icon
                        const isSelected = selectedPlan === plan.key
                        return (
                          <button
                            key={plan.key}
                            type="button"
                            id={`plan-${plan.key}-btn`}
                            onClick={() => setSelectedPlan(plan.key)}
                            className={cn(
                              "w-full rounded-xl border p-4 text-left cursor-pointer transition-all duration-300 relative",
                              isSelected ? plan.selectedClass : plan.accentClass,
                              "bg-white/[0.01] hover:bg-white/[0.025]"
                            )}
                          >
                            {plan.recommended && (
                              <span
                                className="absolute top-3 right-3 text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{ background: `${plan.color}18`, color: plan.color, border: `1px solid ${plan.color}30` }}
                              >
                                Recommended
                              </span>
                            )}

                            <div className="flex items-start gap-3">
                              {/* Selection indicator */}
                              <div
                                className="mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200"
                                style={{
                                  borderColor: isSelected ? plan.color : "rgba(255,255,255,0.15)",
                                  background: isSelected ? plan.color : "transparent",
                                }}
                              >
                                {isSelected && <Check className="h-2.5 w-2.5 text-black" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  {Icon && (
                                    <Icon
                                      className="h-3.5 w-3.5 shrink-0"
                                      style={{ color: plan.color }}
                                    />
                                  )}
                                  <span className="text-sm font-semibold" style={{ color: plan.color !== "white" ? plan.color : undefined }}>
                                    {plan.name}
                                  </span>
                                  <span className="text-[11px] text-white/30 font-mono ml-auto">
                                    {plan.price}
                                  </span>
                                </div>
                                <p className="text-[11px] text-white/40 mb-2">{plan.tagline}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {plan.features.map((f) => (
                                    <span key={f} className="flex items-center gap-1 text-[11px] text-white/35">
                                      <span
                                        className="h-1 w-1 rounded-full shrink-0"
                                        style={{ background: plan.color !== "white" ? plan.color : "rgba(255,255,255,0.4)" }}
                                      />
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <p className="text-[11px] text-white/20 font-mono text-center">
                      No credit card required now · Change plan any time
                    </p>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={goBack}
                        className="flex-1 h-11 border border-white/8 hover:bg-white/5 text-white/60 cursor-pointer"
                        id="plan-back-btn"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        type="button"
                        onClick={goNext}
                        className="flex-1 h-11 font-semibold transition-all rounded-lg cursor-pointer text-black"
                        style={{ background: accentColor }}
                        id="plan-next-btn"
                      >
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── Step 3: Credentials ── */}
                {step === 3 && (
                  <motion.div
                    key="step-creds"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-6"
                  >
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                        Create your account
                      </h1>
                      <p className="mt-1.5 text-sm text-white/40">
                        Your credentials — kept private by default.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                          <Input
                            id="signup-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className={cn(
                              "pl-10 h-11 bg-white/[0.02] border-white/8 hover:border-white/15 text-white placeholder:text-white/20 rounded-lg transition-all",
                              name.trim().length > 0 && "border-white/20"
                            )}
                            style={{
                              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
                            }}
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                          <Input
                            id="signup-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@domain.com"
                            className={cn(
                              "pl-10 h-11 bg-white/[0.02] border-white/8 hover:border-white/15 text-white placeholder:text-white/20 rounded-lg transition-all",
                              email && (emailValid ? "border-[#34D399]/30" : "border-rose-500/30")
                            )}
                            style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}
                          />
                          {email && (
                            <div className={cn("absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full flex items-center justify-center",
                              emailValid ? "bg-[#34D399]/15" : "bg-rose-500/15")}>
                              {emailValid
                                ? <Check className="h-2.5 w-2.5 text-[#34D399]" />
                                : <span className="text-rose-400 text-xs font-bold">!</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                          <Input
                            id="signup-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 8 characters"
                            className="pl-10 pr-10 h-11 bg-white/[0.02] border-white/8 hover:border-white/15 text-white placeholder:text-white/20 rounded-lg transition-all"
                            style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {/* Password strength bar */}
                        {password.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex gap-1 h-0.5">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className="flex-1 rounded-full transition-all duration-300"
                                  style={{
                                    background: i <= pwStrength.score ? pwStrength.color : "rgba(255,255,255,0.06)",
                                  }}
                                />
                              ))}
                            </div>
                            <p className="text-[11px] font-mono" style={{ color: pwStrength.color }}>
                              {pwStrength.label}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Confirm password */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Confirm Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                          <Input
                            id="signup-confirm"
                            type={showConfirm ? "text" : "password"}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Repeat password"
                            className={cn(
                              "pl-10 pr-10 h-11 bg-white/[0.02] border-white/8 hover:border-white/15 text-white placeholder:text-white/20 rounded-lg transition-all",
                              confirm.length > 0 && (passwordsMatch ? "border-[#34D399]/30" : "border-rose-500/30")
                            )}
                            style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                          >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirm.length > 0 && !passwordsMatch && (
                          <p className="text-[11px] text-rose-400 font-mono">Passwords don&apos;t match</p>
                        )}
                      </div>

                      {/* Terms */}
                      <div className="flex items-start gap-3 py-2">
                        <Checkbox
                          id="terms-check"
                          checked={terms}
                          onCheckedChange={(v) => setTerms(Boolean(v))}
                          className="mt-0.5 border-white/20"
                        />
                        <label htmlFor="terms-check" className="text-xs text-white/45 leading-relaxed cursor-pointer select-none">
                          I agree to the{" "}
                          <Link href="/terms" target="_blank" className="text-white underline font-medium hover:text-white/80">
                            Terms & Conditions
                          </Link>{" "}
                          and understand that my project details are NDA-protected by default.
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={goBack}
                        className="flex-1 h-11 border border-white/8 hover:bg-white/5 text-white/60 cursor-pointer"
                        id="creds-back-btn"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        type="button"
                        onClick={goNext}
                        disabled={!step3Valid}
                        className="flex-1 h-11 font-semibold transition-all rounded-lg cursor-pointer text-black disabled:opacity-40"
                        style={{ background: step3Valid ? accentColor : "#4b5563" }}
                        id="creds-next-btn"
                      >
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── Step 4: Profile ── */}
                {step === 4 && (
                  <motion.div
                    key="step-profile"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-6"
                  >
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                        {role === "founder" ? "Tell us about you" : "Your investment profile"}
                      </h1>
                      <p className="mt-1.5 text-sm text-white/40">
                        {role === "founder"
                          ? "Shapes how the AI matches you to investors. Select at least one expertise."
                          : "Helps the AI find the right deals for you. All optional."}
                      </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-5">
                      {role === "founder" ? (
                        /* ── Founder profile fields ── */
                        <div className="space-y-5">
                          {/* Expertise pills */}
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                              <Award className="h-3.5 w-3.5" /> Core Expertise <span className="text-white/25">(select at least one)</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {FOUNDER_EXPERTISE_OPTS.map((opt) => {
                                const active = expertise.includes(opt)
                                return (
                                  <button
                                    type="button"
                                    key={opt}
                                    onClick={() => toggleExpertise(opt)}
                                    className={cn(
                                      "text-[11px] rounded-full px-3 py-1.5 border transition-all duration-200 font-medium cursor-pointer",
                                      active
                                        ? "border-[#34D399]/60 bg-[#34D399]/10 text-[#34D399]"
                                        : "border-white/8 bg-white/[0.01] text-white/40 hover:border-white/15 hover:text-white/70"
                                    )}
                                  >
                                    {active && <Check className="inline h-2.5 w-2.5 mr-1" />}
                                    {opt}
                                  </button>
                                )
                              })}
                            </div>

                            {/* Custom tag */}
                            <div className="flex gap-2 pt-1">
                              <Input
                                placeholder="Add custom skill..."
                                value={newExpertise}
                                onChange={(e) => setNewExpertise(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomExpertise() } }}
                                className="h-9 bg-white/[0.02] border-white/8 text-xs text-white placeholder:text-white/20 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={addCustomExpertise}
                                className="px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs transition-colors cursor-pointer border border-white/8"
                              >
                                Add
                              </button>
                            </div>
                          </div>

                          {/* Experience + Occupation */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Experience</label>
                              <select
                                value={experience}
                                onChange={(e) => setExperience(e.target.value)}
                                className="w-full h-10 rounded-lg bg-[#0d0e11] border border-white/8 px-3 text-xs text-white focus:outline-none focus:border-[#34D399]/30 cursor-pointer transition-all"
                              >
                                <option value="">Select...</option>
                                <option value="junior">Junior (1–2y)</option>
                                <option value="mid">Mid-level (3–5y)</option>
                                <option value="senior">Senior (6y+)</option>
                                <option value="founder">Repeat Founder</option>
                                <option value="executive">Executive</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1"><Briefcase className="h-3 w-3" /> Occupation</label>
                              <select
                                value={occupation}
                                onChange={(e) => setOccupation(e.target.value)}
                                className="w-full h-10 rounded-lg bg-[#0d0e11] border border-white/8 px-3 text-xs text-white focus:outline-none focus:border-[#34D399]/30 cursor-pointer transition-all"
                              >
                                <option value="">Select...</option>
                                <option value="software_engineer">Software Engineer</option>
                                <option value="product_manager">Product Manager</option>
                                <option value="designer">Designer</option>
                                <option value="business_owner">Business Owner</option>
                                <option value="student">Student</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>

                          {/* Social links */}
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                              <Link2 className="h-3.5 w-3.5" /> Social Links <span className="text-white/25">(optional)</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="LinkedIn URL"
                                value={linkedin}
                                onChange={(e) => setLinkedin(e.target.value)}
                                className="h-9 bg-white/[0.02] border-white/8 text-xs text-white placeholder:text-white/20 rounded-lg"
                              />
                              <Input
                                placeholder="GitHub URL"
                                value={github}
                                onChange={(e) => setGithub(e.target.value)}
                                className="h-9 bg-white/[0.02] border-white/8 text-xs text-white placeholder:text-white/20 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* ── Investor profile fields ── */
                        <div className="space-y-5">
                          {/* Firm + Stage */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Firm / Fund</label>
                              <Input
                                placeholder="Fund name (optional)"
                                value={firm}
                                onChange={(e) => setFirm(e.target.value)}
                                className="h-10 bg-white/[0.02] border-white/8 text-xs text-white placeholder:text-white/20 rounded-lg"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1"><DollarSign className="h-3 w-3" /> Stage Focus</label>
                              <select
                                value={investStage}
                                onChange={(e) => setInvestStage(e.target.value)}
                                className="w-full h-10 rounded-lg bg-[#0d0e11] border border-white/8 px-3 text-xs text-white focus:outline-none focus:border-[#E3C27A]/30 cursor-pointer transition-all"
                              >
                                <option value="">Select stage...</option>
                                <option value="angel">Angel Pool</option>
                                <option value="preseed">Pre-seed / Seed</option>
                                <option value="growth">Series A / B</option>
                              </select>
                            </div>
                          </div>

                          {/* Investment interests */}
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                              <Compass className="h-3.5 w-3.5" /> Investment Interests <span className="text-white/25">(optional)</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {INVESTOR_INTEREST_OPTS.map((opt) => {
                                const active = interests.includes(opt)
                                return (
                                  <button
                                    type="button"
                                    key={opt}
                                    onClick={() => toggleInterest(opt)}
                                    className={cn(
                                      "text-[11px] rounded-full px-3 py-1.5 border transition-all duration-200 font-medium cursor-pointer",
                                      active
                                        ? "border-[#E3C27A]/60 bg-[#E3C27A]/10 text-[#E3C27A]"
                                        : "border-white/8 bg-white/[0.01] text-white/40 hover:border-white/15 hover:text-white/70"
                                    )}
                                  >
                                    {active && <Check className="inline h-2.5 w-2.5 mr-1" />}
                                    {opt}
                                  </button>
                                )
                              })}
                            </div>

                            <div className="flex gap-2 pt-1">
                              <Input
                                placeholder="Add custom sector..."
                                value={newInterest}
                                onChange={(e) => setNewInterest(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomInterest() } }}
                                className="h-9 bg-white/[0.02] border-white/8 text-xs text-white placeholder:text-white/20 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={addCustomInterest}
                                className="px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs transition-colors cursor-pointer border border-white/8"
                              >
                                Add
                              </button>
                            </div>
                          </div>

                          {/* Social links */}
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                              <Link2 className="h-3.5 w-3.5" /> Social Links <span className="text-white/25">(optional)</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="LinkedIn URL"
                                value={linkedin}
                                onChange={(e) => setLinkedin(e.target.value)}
                                className="h-9 bg-white/[0.02] border-white/8 text-xs text-white placeholder:text-white/20 rounded-lg"
                              />
                              <Input
                                placeholder="Twitter/X handle"
                                value={twitter}
                                onChange={(e) => setTwitter(e.target.value)}
                                className="h-9 bg-white/[0.02] border-white/8 text-xs text-white placeholder:text-white/20 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {error && (
                        <p className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded-lg p-3">
                          {error}
                        </p>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={goBack}
                          className="flex-1 h-11 border border-white/8 hover:bg-white/5 text-white/60 cursor-pointer"
                          id="profile-back-btn"
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>
                        <Button
                          type="submit"
                          disabled={loading || (role === "founder" && expertise.length === 0)}
                          className="flex-2 h-11 px-8 font-semibold transition-all rounded-lg cursor-pointer text-black disabled:opacity-40"
                          style={{ background: accentColor }}
                          id="signup-submit-btn"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              {role === "founder" ? "Start building" : "Start investing"}
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>

          {/* Already have account */}
          {step !== 1 && (
            <p className="text-center text-xs text-white/30 mt-5">
              Already have an account?{" "}
              <Link href="/login" className="text-white font-medium hover:underline">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
