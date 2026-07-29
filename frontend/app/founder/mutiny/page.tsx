"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Paperclip,
  ArrowUp,
  BrainCircuit,
  Scale,
  FileSearch,
  RefreshCw,
  Info,
} from "lucide-react"
import MutinyResults from "@/components/mutiny-results"
import { queryMutiny, type MutinyResponse, type MutinyMode } from "@/lib/mock-mutiny"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { Corners, hudStagger, hudItem, SomethingMark } from "@/components/hud"

interface AuditPoint {
  label: string
  text: string
}

function parseRationale(rationaleText: string) {
  if (!rationaleText) return { title: "", points: [] }
  const lines = rationaleText.split("\n")
  const title = lines[0]?.replace(/:$/, "").trim() || ""
  const points: AuditPoint[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith("•") || line.startsWith("-")) {
      const content = line.substring(1).trim()
      const colonIdx = content.indexOf(":")
      if (colonIdx !== -1) {
        const label = content.substring(0, colonIdx).trim()
        const text = content.substring(colonIdx + 1).trim()
        points.push({ label, text })
      } else {
        points.push({ label: "Analysis Point", text: content })
      }
    }
  }

  return { title, points }
}

const ACCENTS = {
  emerald: {
    name: "Console Sage",
    text: "text-[#8EA38E]",
    bg: "bg-[#8EA38E]",
    border: "border-[#8EA38E]/25",
    glow: "",
    btnBg: "bg-[#8EA38E] text-background hover:bg-[#8EA38E]/90",
    ring: "focus-within:ring-1 focus-within:ring-[#8EA38E]/20 focus-within:border-[#8EA38E]/30",
    activePill: "bg-[#8EA38E]/10 text-[#8EA38E] border-[#8EA38E]/30",
    color: "#8EA38E",
  },
  indigo: {
    name: "Tactile Chalk",
    text: "text-[#E2DFD5]",
    bg: "bg-[#E2DFD5]",
    border: "border-[#E2DFD5]/25",
    glow: "",
    btnBg: "bg-[#E2DFD5] text-background hover:bg-[#E2DFD5]/90",
    ring: "focus-within:ring-1 focus-within:ring-[#E2DFD5]/20 focus-within:border-[#E2DFD5]/30",
    activePill: "bg-[#E2DFD5]/10 text-[#E2DFD5] border-[#E2DFD5]/30",
    color: "#E2DFD5",
  },
  violet: {
    name: "Anodized Steel",
    text: "text-[#8293A4]",
    bg: "bg-[#8293A4]",
    border: "border-[#8293A4]/25",
    glow: "",
    btnBg: "bg-[#8293A4] text-background hover:bg-[#8293A4]/90",
    ring: "focus-within:ring-1 focus-within:ring-[#8293A4]/20 focus-within:border-[#8293A4]/30",
    activePill: "bg-[#8293A4]/10 text-[#8293A4] border-[#8293A4]/30",
    color: "#8293A4",
  },
  amber: {
    name: "Earthy Copper",
    text: "text-[#C88E72]",
    bg: "bg-[#C88E72]",
    border: "border-[#C88E72]/25",
    glow: "",
    btnBg: "bg-[#C88E72] text-background hover:bg-[#C88E72]/90",
    ring: "focus-within:ring-1 focus-within:ring-[#C88E72]/20 focus-within:border-[#C88E72]/30",
    activePill: "bg-[#C88E72]/10 text-[#C88E72] border-[#C88E72]/30",
    color: "#C88E72",
  },
}

function getSimulationSteps(m: MutinyMode) {
  switch (m) {
    case "support":
      return [
        "Initializing conviction core weights...",
        "Analyzing emotional resonance profiles...",
        "Synthesizing belief resonance metrics..."
      ]
    case "critic":
      return [
        "Initializing skeptic critique cores...",
        "Analyzing user friction coefficients...",
        "Mapping user retention vulnerabilities..."
      ]
    case "feature":
      return [
        "Initializing systems architectural specs...",
        "Testing SQLite/CRDT database local replication thresholds...",
        "Auditing hosting/infrastructure cost matrices..."
      ]
    case "match":
      return [
        "Initializing WIPO & USPTO registry sweeps...",
        "Auditing matching cohort patent claims...",
        "Searching active founder & VC match alignments..."
      ]
    default:
      return ["Running simulation audit..."]
  }
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  activeMode?: MutinyMode
  cachedResults?: Record<string, MutinyResponse | null | undefined>
  isSimulatingMode?: Record<string, boolean | undefined>
  scanLinesMode?: Record<string, string[] | undefined>
  uploadedFile?: { name: string; size: number } | null
}

export default function FounderMutinyPage() {
  const [concept, setConcept] = useState("")
  const [mode, setMode] = useState<MutinyMode>("support")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSimulatingGlobal, setIsSimulatingGlobal] = useState(false)
  const [userName, setUserName] = useState("")
  const [accentKey, setAccentKey] = useState<keyof typeof ACCENTS>("emerald")
  const [expandedThoughts, setExpandedThoughts] = useState<{ [key: string]: boolean }>({})
  const [showGlossary, setShowGlossary] = useState(false)
  const [showCreatureTip, setShowCreatureTip] = useState(true)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null)

  const feedEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeAccent = ACCENTS[accentKey]

  const PRESET_PROMPTS = [
    {
      title: "Stress-Test Sync Node",
      prompt: "A peer-to-peer sync engine using SQLite and local CRDT conflict resolution for instant startup without database latency...",
      icon: BrainCircuit,
      color: "text-amber-500 border-border/10 hover:border-border/30 dark:border-border/5 dark:bg-foreground/[0.01] dark:hover:border-border/10"
    },
    {
      title: "Verify Wallet Pooling",
      prompt: "A multi-sig transaction escrow system allowing developers to pool community stakes for project milestones with automated release rules...",
      icon: Scale,
      color: "text-indigo-500 border-border/10 hover:border-border/30 dark:border-border/5 dark:bg-foreground/[0.01] dark:hover:border-border/10"
    },
    {
      title: "Patent Overlaps",
      prompt: "Audit patent claims and VC cohort registrations matching key-value storage syncing systems and distributed peer discovery protocols...",
      icon: FileSearch,
      color: "text-pink-500 border-border/10 hover:border-border/30 dark:border-border/5 dark:bg-foreground/[0.01] dark:hover:border-border/10"
    },
  ]

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedProfile = localStorage.getItem("founder_profile_data")
      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile)
          if (parsed.name) setUserName(parsed.name)
        } catch (e) {
          console.error(e)
        }
      }

      const storedAccent = localStorage.getItem("founder_settings_accent") as keyof typeof ACCENTS
      if (storedAccent && ACCENTS[storedAccent]) {
        setAccentKey(storedAccent)
      }
    }
  }, [])

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`
    }
  }, [concept])

  useEffect(() => {
    if (showCreatureTip) {
      const timer = setTimeout(() => {
        setShowCreatureTip(false)
      }, 7000)
      return () => clearTimeout(timer)
    }
  }, [showCreatureTip, mode])

  const toggleThoughts = (id: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.split(".").pop()?.toLowerCase()
    if (extension === "zip") {
      toast({
        title: "Upload Blocked",
        description: "ZIP archives are not allowed. Please upload only PDF or Word documents.",
        variant: "destructive",
      })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    if (extension !== "pdf" && extension !== "doc" && extension !== "docx") {
      toast({
        title: "Invalid File Type",
        description: "Only PDF (.pdf) and Word documents (.doc, .docx) are supported.",
        variant: "destructive",
      })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploadedFile({
      name: file.name,
      size: file.size,
    })
  }

  const handleSelectMode = async (newMode: MutinyMode) => {
    setMode(newMode)
    setShowCreatureTip(true)

    const assistantMessages = messages.filter((m) => m.role === "assistant")
    if (assistantMessages.length === 0) return

    const lastMsg = assistantMessages[assistantMessages.length - 1]

    setMessages((prev) =>
      prev.map((m) =>
        m.id === lastMsg.id ? { ...m, activeMode: newMode } : m
      )
    )

    if (lastMsg.cachedResults?.[newMode] || lastMsg.isSimulatingMode?.[newMode]) {
      return
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === lastMsg.id
          ? {
              ...m,
              isSimulatingMode: {
                ...m.isSimulatingMode,
                [newMode]: true
              },
              scanLinesMode: {
                ...m.scanLinesMode,
                [newMode]: []
              }
            }
          : m
      )
    )

    const activeSteps = getSimulationSteps(newMode)
    for (let i = 0; i < activeSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === lastMsg.id
            ? {
                ...msg,
                scanLinesMode: {
                  ...msg.scanLinesMode,
                  [newMode]: [...(msg.scanLinesMode?.[newMode] || []), activeSteps[i]]
                }
              }
            : msg
        )
      )
    }

    try {
      const userMsgIdx = messages.findIndex((m) => m.id === lastMsg.id) - 1
      const promptText = userMsgIdx >= 0 ? messages[userMsgIdx].content : ""
      if (!promptText) return

      const res = await queryMutiny(promptText, newMode)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === lastMsg.id
            ? {
                ...msg,
                isSimulatingMode: {
                  ...msg.isSimulatingMode,
                  [newMode]: false
                },
                cachedResults: {
                  ...msg.cachedResults,
                  [newMode]: res
                }
              }
            : msg
        )
      )
    } catch (err) {
      console.error(err)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === lastMsg.id
            ? {
                ...msg,
                isSimulatingMode: {
                  ...msg.isSimulatingMode,
                  [newMode]: false
                },
                cachedResults: {
                  ...msg.cachedResults,
                  [newMode]: { rationale: "Simulation connection error." }
                }
              }
            : msg
        )
      )
    }
  }

  const handleStartSimulation = async (presetText?: string) => {
    const textToSubmit = presetText || concept
    if (!textToSubmit.trim() || isSimulatingGlobal) return

    setIsSimulatingGlobal(true)
    setConcept("")

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSubmit,
      uploadedFile: uploadedFile,
      timestamp: timeString,
    }

    // Reset current file input state
    setUploadedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""

    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      activeMode: mode,
      cachedResults: {},
      isSimulatingMode: { [mode]: true },
      scanLinesMode: { [mode]: [] },
      timestamp: timeString,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const activeSteps = getSimulationSteps(mode)
    for (let i = 0; i < activeSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                scanLinesMode: {
                  ...msg.scanLinesMode,
                  [mode]: [...(msg.scanLinesMode?.[mode] || []), activeSteps[i]]
                }
              }
            : msg
        )
      )
    }

    try {
      const res = await queryMutiny(textToSubmit, mode)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                isSimulatingMode: {
                  ...msg.isSimulatingMode,
                  [mode]: false
                },
                cachedResults: {
                  ...msg.cachedResults,
                  [mode]: res
                }
              }
            : msg
        )
      )
    } catch (err) {
      console.error(err)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                isSimulatingMode: {
                  ...msg.isSimulatingMode,
                  [mode]: false
                },
                cachedResults: {
                  ...msg.cachedResults,
                  [mode]: { rationale: "Simulation connection error." }
                }
              }
            : msg
        )
      )
    } finally {
      setIsSimulatingGlobal(false)
    }
  }

  const getInitials = (n: string) => {
    return n
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  const getModeExplanation = (m: MutinyMode) => {
    switch (m) {
      case "support":
        return "I'm in Something (Belief) mode! I'll find the core strengths, resonance triggers, and growth solutions for your idea."
      case "critic":
        return "I'm in Nothing (Doubt) mode! I'll identify friction points, churn risks, and monetization challenges."
      case "feature":
        return "I'm in Viability specs mode! I'll check UX complexity, SQLite/CRDT local feasibility, and hosting cost projections."
      case "match":
        return "I'm in IP overlaps mode! I'll help you find builders with similar ideas, complementary skills, or matching cohort projects to build with."
      default:
        return ""
    }
  }

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] min-h-0 flex flex-col p-4 lg:p-6 overflow-hidden relative text-foreground">
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Background Starfield & Gravitational Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8%" cy="12%" r="1" fill="#fff" className="animate-pulse" />
          <circle cx="18%" cy="32%" r="1.5" fill="#fff" className="animate-ping" style={{ animationDuration: "3s" }} />
          <circle cx="48%" cy="27%" r="1" fill="#fff" className="animate-pulse" style={{ animationDuration: "2s" }} />
          <circle cx="88%" cy="17%" r="1.2" fill="#fff" className="animate-pulse" style={{ animationDuration: "4s" }} />
          <circle cx="98%" cy="47%" r="1.5" fill="#fff" className="animate-ping" style={{ animationDuration: "5s" }} />
          <circle cx="38%" cy="77%" r="1" fill="#fff" className="animate-pulse" style={{ animationDuration: "2.5s" }} />
          <circle cx="78%" cy="87%" r="1.3" fill="#fff" className="animate-pulse" style={{ animationDuration: "3.5s" }} />
          <circle cx="22%" cy="92%" r="1" fill="#fff" className="animate-ping" style={{ animationDuration: "6s" }} />
          
          <circle cx="50%" cy="50%" r="220" fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth="1" strokeDasharray="5,5" />
          <circle cx="50%" cy="50%" r="380" fill="none" stroke="rgba(255,255,255,0.01)" strokeWidth="1" />
          <path d="M 50% 10% L 50% 90% M 10% 50% L 90% 50%" stroke="rgba(255,255,255,0.008)" strokeWidth="1" strokeDasharray="3,6" />
        </svg>
      </div>

      {/* Decorative Blur Orbs */}
      <div className="pointer-events-none absolute top-12 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/[0.03] blur-[120px] z-0" />
      <div className="pointer-events-none absolute bottom-12 right-1/4 w-[600px] h-[600px] rounded-full bg-blue-500/[0.03] blur-[150px] z-0" />

      {/* HUD Branded Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/20 shrink-0 pt-0.5 relative z-10">
        <div className="flex items-center gap-3.5">
          <SomethingMark size={44} />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl lg:text-2xl font-serif font-light tracking-tight text-foreground leading-tight">Nothing & Something</h2>
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-brand-accent bg-brand-accent/10 border border-brand-accent/25 rounded px-2 py-0.5">
                AI Dual Co-Pilot
              </span>
            </div>
            <p className="text-foreground/75 dark:text-foreground/50 text-xs font-sans font-light leading-relaxed">
              Stress-test milestone & conviction nodes with twin AI minds — <span className="text-[#8EA38E] font-medium">Something</span> (Belief) & <span className="text-[#C88E72] font-medium">Nothing</span> (Doubt).
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessages([])}
            className="h-8 rounded-lg border-border/40 hover:bg-accent text-xs font-mono tracking-wide cursor-pointer text-foreground/80 hover:text-foreground transition-all shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Session
          </Button>
        )}
      </div>

      {/* Core Split Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 flex-1 min-h-0 mt-4 relative z-10">
        
        {/* Left Column: Interactive Mode Panels (2/5) */}
        <div className="lg:col-span-2 flex flex-col min-h-0 pr-1 overflow-y-auto scrollbar-thin space-y-4 select-text">
          
          <div className="text-xs font-mono uppercase tracking-widest text-foreground/45 font-bold px-1 pt-0.5">
            Audit Perspectives
          </div>

          {[
            {
              id: "support" as MutinyMode,
              title: "Something (Belief)",
              desc: "Resonance & growth framework focusing on strengths, emotional hooks, and value retention.",
              icon: ShieldCheck,
              colorHex: "#8EA38E",
              metric: "Resonance OK",
            },
            {
              id: "critic" as MutinyMode,
              title: "Nothing (Doubt)",
              desc: "Skeptical review highlighting friction points, churn risks, and monetization flaws.",
              icon: ShieldAlert,
              colorHex: "#C88E72",
              metric: "Doubt Triggered",
            },
            {
              id: "feature" as MutinyMode,
              title: "Viability Specs",
              desc: "Engineering and cost feasibility details, verifying local database sync latency.",
              icon: BrainCircuit,
              colorHex: "#8293A4",
              metric: "Specs Valid",
            },
            {
              id: "match" as MutinyMode,
              title: "IP Overlaps",
              desc: "Find co-founders with similar ideas, matching skills, or overlapping patent and cohort registrations.",
              icon: FileSearch,
              colorHex: "#E2DFD5",
              metric: "Patents Found",
            },
          ].map((item) => {
            const IconComponent = item.icon
            const isActive = mode === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleSelectMode(item.id)}
                className={cn(
                  "w-full rounded-xl border text-left p-4 space-y-2.5 transition-all duration-200 cursor-pointer bg-card/10 select-none shadow-sm relative overflow-hidden group",
                  isActive
                    ? "bg-foreground/[0.02] shadow-md ring-1 ring-[var(--brand-accent)]/20"
                    : "border-border/15 hover:border-border/30 hover:bg-card/15"
                )}
                style={{
                  borderColor: isActive ? item.colorHex : undefined,
                }}
              >
                {/* Active side indicator & HUD corner frame */}
                {isActive && (
                  <>
                    <Corners className="opacity-70" />
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: item.colorHex }}
                    />
                  </>
                )}

                <div className="flex items-center justify-between">
                  <span
                    className="text-xs sm:text-[13px] font-mono uppercase tracking-widest flex items-center gap-1.5 font-semibold transition"
                    style={{ color: isActive ? item.colorHex : "rgba(255,255,255,0.4)" }}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    {item.title}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/50 border border-border/10">
                    {item.metric}
                  </span>
                </div>

                <p className="text-[13px] sm:text-sm text-foreground/75 dark:text-muted-foreground leading-relaxed font-sans font-light">
                  {item.desc}
                </p>
              </button>
            )
          })}

          {/* Collapsible Glossary Section inside left panel */}
          <div className="rounded-xl border border-border/10 bg-card/5 p-4 space-y-2 shadow-inner mt-auto">
            <button
              onClick={() => setShowGlossary(!showGlossary)}
              className="flex items-center gap-1.5 text-xs font-mono text-brand-accent hover:text-brand-accent/80 transition cursor-pointer select-none bg-transparent border-0 p-0"
            >
              <Info className="h-3.5 w-3.5" />
              <span>{showGlossary ? "Hide Glossary Details" : "How does the audit work?"}</span>
            </button>
            {showGlossary && (
              <p className="text-xs text-foreground/60 leading-relaxed font-sans font-light mt-1.5">
                Submit your idea in the chat input. Click any card above to view the dynamic AI audit report from that perspective. The results are loaded on demand and cached locally.
              </p>
            )}
          </div>

        </div>

        {/* Right Column: Chat Playground Area (3/5) */}
        <div className="lg:col-span-3 flex flex-col min-h-0 h-full relative">
          
          {/* Scrollable conversation window */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin min-h-0 select-text">
            {messages.length === 0 ? (
              
              /* Welcome Screen inside Chat area */
              <div className="space-y-6 py-4 max-w-2xl mx-auto text-center">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="size-10 rounded-full border border-border/20 bg-foreground/[0.02] flex items-center justify-center shadow-sm">
                    <BrainCircuit className="h-5 w-5 text-foreground/50" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg sm:text-xl font-serif font-light text-foreground tracking-tight">How can I challenge your idea?</h3>
                    <p className="text-foreground/70 dark:text-foreground/50 text-xs sm:text-sm max-w-md mx-auto leading-relaxed font-sans font-light">
                      Type a concept below to audit its co-founder matches, investor alignments, or potential friction points.
                    </p>
                  </div>
                </div>

                {/* Preset Prompt Cards */}
                <div className="grid gap-3 sm:grid-cols-3 pt-2">
                  {PRESET_PROMPTS.map((item, i) => {
                    const PromptIcon = item.icon
                    return (
                      <motion.button
                        key={i}
                        onClick={() => handleStartSimulation(item.prompt)}
                        whileHover={{ scale: 1.01, y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all w-full cursor-pointer bg-card/10 border-border/20 hover:border-border/40 hover:bg-card/25 group shadow-sm",
                          item.color
                        )}
                      >
                        <PromptIcon className="h-4.5 w-4.5 mb-2 opacity-60 group-hover:opacity-100 transition" />
                        <span className="text-xs sm:text-sm font-semibold font-mono uppercase tracking-wider text-foreground/95">{item.title}</span>
                        <p className="text-xs text-foreground/75 dark:text-foreground/50 mt-1.5 leading-relaxed font-sans font-light line-clamp-3">
                          {item.prompt}
                        </p>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Simulation Telemetry Console */}
                <div className="mt-4 rounded-lg border border-border/20 bg-card/10 p-4 space-y-3 shadow-sm text-left">
                  <div className="flex items-center justify-between border-b border-border/20 pb-2 text-xs font-mono uppercase tracking-wider text-foreground/50 font-bold">
                    <span>Simulation Telemetry Log</span>
                    <span className="text-emerald-500 animate-pulse flex items-center gap-1 font-semibold text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      LIVE STREAM
                    </span>
                  </div>
                  <div className="font-mono text-xs text-foreground/75 dark:text-foreground/45 space-y-1.5 leading-relaxed">
                    <div className="flex justify-between">
                      <span>[19:42:01] P2P Sync Node: Resonance 78% (Passed)</span>
                      <span className="text-emerald-500 font-semibold">Resonance OK</span>
                    </div>
                    <div className="flex justify-between">
                      <span>[19:24:18] Web3 Wallet Pooling: Conviction 48% (Failed)</span>
                      <span className="text-[#C88E72] font-semibold">Doubt Triggered</span>
                    </div>
                    <div className="flex justify-between">
                      <span>[18:55:40] DePIN Sensor Mesh: Resonance 82% (Passed)</span>
                      <span className="text-emerald-500/80 font-semibold">Resonance OK</span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              
              /* Messages Viewport */
              <div className="space-y-6 py-1">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const isUser = msg.role === "user"
                    const isExpanded = !!expandedThoughts[msg.id]

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={cn("flex gap-3 w-full", isUser ? "justify-end" : "justify-start")}
                      >
                        {!isUser && (
                          <div className="size-7 rounded-full border border-border/20 bg-card/20 flex items-center justify-center shrink-0 mt-0.5">
                            <BrainCircuit className="h-3.5 w-3.5 text-foreground/40" />
                          </div>
                        )}

                        <div className={cn("max-w-[85%] space-y-3", isUser ? "text-right" : "text-left")}>
                          
                          {isUser ? (
                            /* User Bubble */
                            <div className="inline-block rounded-2xl bg-muted/15 border border-border/25 px-4 py-2.5 text-sm sm:text-base text-foreground/90 font-sans font-light leading-relaxed text-left shadow-sm">
                              {msg.uploadedFile && (
                                <div className="flex items-center gap-1.5 bg-foreground/10 border border-border/15 rounded-lg px-2.5 py-1.5 text-xs text-foreground/80 mb-2 font-mono">
                                  <span>📄 {msg.uploadedFile.name}</span>
                                </div>
                              )}
                              {msg.content}
                            </div>
                          ) : (
                            
                            /* Assistant Bubble */
                            <div className="w-full space-y-3">
                              
                              {/* Case 1: Simulation loader */}
                              {msg.activeMode && msg.isSimulatingMode?.[msg.activeMode] ? (
                                <div className="w-full rounded-xl border border-border/20 bg-background/20 p-4 font-mono text-xs space-y-2.5 shadow-inner">
                                  <div className="flex items-center gap-2 text-foreground/50">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-accent" />
                                    <span className="text-xs uppercase tracking-wider font-bold">
                                      Auditing {msg.activeMode === "support" ? "Belief" : msg.activeMode === "critic" ? "Doubt" : msg.activeMode === "feature" ? "Viability" : "IP Overlaps"}...
                                    </span>
                                  </div>
                                  <div className="space-y-0.5 pl-2.5 border-l border-brand-accent/30 text-foreground/45">
                                    {msg.scanLinesMode?.[msg.activeMode]?.map((line: string, idx: number) => (
                                      <div key={idx} className="break-all">&gt; {line}</div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                
                                /* Case 2: Analysis Results */
                                <div className="space-y-3 w-full">
                                  
                                  {/* DeepSeek Collapsible Thought Block */}
                                  <div className="border-b border-border/10 pb-2">
                                    <button
                                      onClick={() => toggleThoughts(msg.id)}
                                      className="flex items-center gap-1.5 text-xs font-mono text-foreground/50 hover:text-foreground/70 transition cursor-pointer select-none bg-transparent border-0 p-0"
                                    >
                                      <div className={cn("size-1.5 rounded-full", isExpanded ? "bg-foreground/40" : "bg-brand-accent")} />
                                      <span>{isExpanded ? "Hide thinking process" : "Show thinking process"}</span>
                                    </button>
                                    
                                    {isExpanded && msg.activeMode && msg.scanLinesMode?.[msg.activeMode] && (
                                      <div className="mt-2 p-3 bg-muted/5 rounded-xl border border-border/10 font-mono text-xs text-foreground/60 space-y-1">
                                        {msg.scanLinesMode[msg.activeMode]?.map((line, idx) => (
                                          <div key={idx} className="break-all">&gt; {line}</div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Duality Prose Copy */}
                                  {msg.activeMode && msg.cachedResults?.[msg.activeMode] && (
                                    <div className="text-sm sm:text-base text-foreground/90 leading-relaxed font-sans space-y-3 font-light">
                                      {msg.activeMode === "critic" && (
                                        <div className="space-y-2.5">
                                          <div className="text-xs font-bold font-mono uppercase tracking-wider text-[#C88E72] flex items-center gap-1.5">
                                            <ShieldAlert className="h-3.5 w-3.5" /> Critique Analysis (Nothing)
                                          </div>
                                          <div className="pl-3.5 border-l border-[#C88E72]/30 space-y-2.5">
                                            {parseRationale(msg.cachedResults.critic?.rationale || "").points.map((pt, idx) => (
                                              <div key={idx} className="space-y-0.5">
                                                <span className="font-semibold text-foreground text-xs sm:text-sm font-sans">{pt.label}</span>
                                                <p className="text-foreground/75 text-xs sm:text-sm font-light leading-relaxed">{pt.text}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {msg.activeMode === "support" && (
                                        <div className="space-y-2.5">
                                          <div className="text-xs font-bold font-mono uppercase tracking-wider text-brand-accent flex items-center gap-1.5">
                                            <ShieldCheck className="h-3.5 w-3.5" /> Resonance Framework (Something)
                                          </div>
                                          <div className="pl-3.5 border-l border-brand-accent/30 space-y-2.5">
                                            {parseRationale(msg.cachedResults.support?.rationale || "").points.map((pt, idx) => (
                                              <div key={idx} className="space-y-0.5">
                                                <span className="font-semibold text-foreground text-xs sm:text-sm font-sans">{pt.label}</span>
                                                <p className="text-foreground/75 text-xs sm:text-sm font-light leading-relaxed">{pt.text}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {msg.activeMode === "feature" && (
                                        <div className="space-y-2.5">
                                          <div className="text-xs font-bold font-mono uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                                            <BrainCircuit className="h-3.5 w-3.5" /> Viability Specifications
                                          </div>
                                          <div className="pl-3.5 border-l border-violet-400/30 space-y-2.5">
                                            {parseRationale(msg.cachedResults.feature?.rationale || "").points.map((pt, idx) => (
                                              <div key={idx} className="space-y-0.5">
                                                <span className="font-semibold text-foreground text-xs sm:text-sm font-sans">{pt.label}</span>
                                                <p className="text-foreground/75 text-xs sm:text-sm font-light leading-relaxed">{pt.text}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {msg.activeMode === "match" && (
                                        <div className="space-y-2.5">
                                          <div className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                            <FileSearch className="h-3.5 w-3.5" /> IP & Alignment Overlaps
                                          </div>
                                          <div className="pl-3.5 border-l border-indigo-400/30 space-y-2.5">
                                            {parseRationale(msg.cachedResults.match?.rationale || "").points.map((pt, idx) => (
                                              <div key={idx} className="space-y-0.5">
                                                <span className="font-semibold text-foreground text-xs sm:text-sm font-sans">{pt.label}</span>
                                                <p className="text-foreground/75 text-xs sm:text-sm font-light leading-relaxed">{pt.text}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Results Overlaps & Lists */}
                                  {msg.activeMode && msg.cachedResults?.[msg.activeMode] && (
                                    <MutinyResults data={msg.cachedResults[msg.activeMode]!} accentKey={accentKey} />
                                  )}

                                </div>
                              )}

                            </div>
                          )}

                        </div>

                        {isUser && (
                          <div className="size-7 rounded-full border border-border/20 shrink-0 bg-card/25 flex items-center justify-center text-xs font-mono font-bold text-foreground/60 shadow mt-0.5">
                            {getInitials(userName)}
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                <div ref={feedEndRef} />
              </div>
            )}
          </div>

          {/* Floating Chat Input Capsule with HUD Corners */}
          <div className="w-full pt-3 pb-1 shrink-0 z-20">
            <div className={cn(
              "relative bg-background/85 border border-border/20 rounded-xl p-2.5 flex flex-col gap-1.5 transition focus-within:border-border/40 focus-within:bg-background shadow-lg overflow-hidden",
              activeAccent.ring
            )}>
              <Corners className="opacity-50" />
              
              {/* File Pill Preview */}
              {uploadedFile && (
                <div className="flex items-center gap-2 bg-foreground/5 border border-border/10 rounded-md px-2.5 py-1 text-xs text-foreground/80 w-fit select-none mb-1 shadow-sm font-mono">
                  <span>📄 {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="text-foreground/40 hover:text-foreground/70 font-bold ml-1.5 cursor-pointer bg-transparent border-0 p-0"
                  >
                    ×
                  </button>
                </div>
              )}

              <Textarea
                ref={textareaRef}
                rows={1}
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ask a question or test an overlap spec..."
                className="w-full bg-transparent border-0 text-foreground placeholder:text-foreground/50 text-sm sm:text-base leading-relaxed resize-none p-1 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[38px] shadow-none font-sans"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleStartSimulation()
                  }
                }}
              />
              
              <div className="flex items-center justify-between px-1 pt-1.5 border-t border-border/10">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    className="p-1 rounded text-foreground/45 hover:text-foreground/75 transition cursor-pointer bg-transparent border-0"
                    title="Attach PDF or Word document"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-mono text-foreground/35 tracking-wider uppercase">
                    Active Mode: {mode === "support" ? "Belief" : mode === "critic" ? "Doubt" : mode === "feature" ? "Viability" : "IP Overlaps"}
                  </span>
                </div>

                <button
                  onClick={() => handleStartSimulation()}
                  disabled={!concept.trim() || isSimulatingGlobal}
                  className={cn(
                    "size-7 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer shadow-md",
                    concept.trim().length > 0 && !isSimulatingGlobal
                      ? activeAccent.btnBg
                      : "bg-foreground/5 text-foreground/35 border border-border/10 cursor-not-allowed"
                  )}
                  aria-label="Submit"
                >
                  {isSimulatingGlobal ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Floating Creature Tooltip */}
          <AnimatePresence>
            {showCreatureTip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-[76px] left-3 z-50 flex items-start gap-3 bg-background/95 border border-[#C88E72]/20 rounded-xl p-3 shadow-2xl max-w-[280px] backdrop-blur-md"
              >
                <div className="size-8 rounded-lg shrink-0 overflow-hidden bg-black flex items-center justify-center border border-border/10">
                  <img
                    src="/TheThing.png"
                    alt="The Thing"
                    className="size-8 object-contain invert mix-blend-screen"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#C88E72]">The Thing</span>
                    <button
                      onClick={() => setShowCreatureTip(false)}
                      className="text-foreground/45 hover:text-foreground/75 text-xs font-bold leading-none cursor-pointer bg-transparent border-0 p-0 ml-4"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-xs text-foreground/85 dark:text-muted-foreground leading-relaxed font-sans font-light">
                    {getModeExplanation(mode)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

    </div>
  )
}
