"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Bell,
  Shield,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Check,
  Loader2,
  Users,
  Globe,
  Key,
  Mail,
  AlertTriangle,
  Smartphone,
  Laptop,
  Terminal,
  Camera,
  Palette,
  X,
  User,
  Wallet
} from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "profile" | "notifications" | "security" | "billing" | "danger"

interface ProfileData {
  name: string
  avatarUrl: string
  headline: string
  location: string
  isVerified: boolean
  about: string
  socials: {
    linkedin: string
    twitter: string
    website: string
  }
  skills: string[]
}

const DEFAULT_PROFILE: ProfileData = {
  name: "",
  avatarUrl: "",
  headline: "",
  location: "",
  isVerified: false,
  about: "",
  socials: {
    linkedin: "",
    twitter: "",
    website: "",
  },
  skills: [],
}

// Preset Glowing Avatars
const PRESET_AVATARS = [
  // Deep Aurora — indigo → teal
  "linear-gradient(145deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a7a8a 100%)",
  // Dusk Copper — warm clay → burnt sienna
  "linear-gradient(150deg, #3d1c02 0%, #7c3a1e 35%, #c4622d 70%, #e8946a 100%)",
  // Ocean Ink — deep navy → soft cyan
  "linear-gradient(135deg, #0d1b2a 0%, #1b3a4b 40%, #1c6e8a 75%, #4eb3c8 100%)",
  // Forest Ember — dark olive → sage
  "linear-gradient(140deg, #0d1f0e 0%, #1e3d20 35%, #3a6b3e 65%, #7aad7e 100%)",
  // Slate Rose — charcoal → dusty mauve
  "linear-gradient(150deg, #1a1520 0%, #2e2040 40%, #5c3d6b 70%, #9c7aaa 100%)",
  // Midnight Sand — black → warm stone
  "linear-gradient(135deg, #0f0e0d 0%, #2a2520 40%, #5c5040 70%, #a08c72 100%)",
  // Obsidian Steel — near-black → steel blue
  "linear-gradient(145deg, #0a0c10 0%, #1a2030 40%, #2a3d5a 70%, #5878a0 100%)",
  // Ash Crimson — charcoal → deep red
  "linear-gradient(140deg, #140a0a 0%, #2e1010 35%, #6b2020 65%, #b04040 100%)",
]

interface ToastItem {
  id: string
  title: string
  description?: string
  type: "success" | "warning" | "info" | "error"
}

// Accent Color Configurations
const ACCENTS = {
  emerald: {
    name: "Console Sage",
    text: "text-[#8EA38E]",
    bg: "bg-[#8EA38E]",
    border: "border-[#8EA38E]/25",
    glow: "",
    borderHighlight: "border-[#8EA38E]",
    textHighlight: "text-[#8EA38E]",
    btnBg: "bg-[#8EA38E] text-background hover:bg-[#8EA38E]/90",
    toggleBg: "data-[state=checked]:bg-[#8EA38E]",
    color: "#8EA38E",
    ring: "focus-within:ring-1 focus-within:ring-[#8EA38E]/20 focus-within:border-[#8EA38E]/30",
  },
  indigo: {
    name: "Tactile Chalk",
    text: "text-[#E2DFD5]",
    bg: "bg-[#E2DFD5]",
    border: "border-[#E2DFD5]/25",
    glow: "",
    borderHighlight: "border-[#E2DFD5]",
    textHighlight: "text-[#E2DFD5]",
    btnBg: "bg-[#E2DFD5] text-background hover:bg-[#E2DFD5]/90",
    toggleBg: "data-[state=checked]:bg-[#E2DFD5]",
    color: "#E2DFD5",
    ring: "focus-within:ring-1 focus-within:ring-[#E2DFD5]/20 focus-within:border-[#E2DFD5]/30",
  },
  violet: {
    name: "Anodized Steel",
    text: "text-[#8293A4]",
    bg: "bg-[#8293A4]",
    border: "border-[#8293A4]/25",
    glow: "",
    borderHighlight: "border-[#8293A4]",
    textHighlight: "text-[#8293A4]",
    btnBg: "bg-[#8293A4] text-background hover:bg-[#8293A4]/90",
    toggleBg: "data-[state=checked]:bg-[#8293A4]",
    color: "#8293A4",
    ring: "focus-within:ring-1 focus-within:ring-[#8293A4]/20 focus-within:border-[#8293A4]/30",
  },
  amber: {
    name: "Earthy Copper",
    text: "text-[#C88E72]",
    bg: "bg-[#C88E72]",
    border: "border-[#C88E72]/25",
    glow: "",
    borderHighlight: "border-[#C88E72]",
    textHighlight: "text-[#C88E72]",
    btnBg: "bg-[#C88E72] text-background hover:bg-[#C88E72]/90",
    toggleBg: "data-[state=checked]:bg-[#C88E72]",
    color: "#C88E72",
    ring: "focus-within:ring-1 focus-within:ring-[#C88E72]/20 focus-within:border-[#C88E72]/30",
  },
}

export default function FounderSettingsPage() {
  const router = useRouter()
  const { logout } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>("profile")
  const [accentKey, setAccentKey] = useState<keyof typeof ACCENTS>("emerald")

  // Toast stack state
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Profile Form States
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [profileVisibility, setProfileVisibility] = useState("public")
  const [showEmail, setShowEmail] = useState(false)
  const [allowMessages, setAllowMessages] = useState(true)

  // Notification States
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [fundingUpdates, setFundingUpdates] = useState(true)
  const [teamUpdates, setTeamUpdates] = useState(true)

  // Credentials States
  const [email, setEmail] = useState("")
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // Plans & Billing state
  const [selectedPlan, setSelectedPlan] = useState("free")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const plan = localStorage.getItem("selected_plan") || "free"
      setSelectedPlan(plan)
    }
  }, [])

  const handlePlanUpgrade = (plan: string) => {
    setSelectedPlan(plan)
    localStorage.setItem("selected_plan", plan)
    window.dispatchEvent(new CustomEvent("selected-plan-change"))
    addToast("Subscription Updated", `Successfully switched workspace plan to "${plan.toUpperCase()}"`, "success")
  }
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Active Sessions States
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; browser: string; location: string; active: boolean; time: string }>>([])
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // Danger modal states
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [wipeLogs, setWipeLogs] = useState<string[]>([])

  // Auto saving indicators
  const [savingKeys, setSavingKeys] = useState<Record<string, "saving" | "saved" | null>>({})

  // File upload helper ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeAccent = ACCENTS[accentKey]

  // Add Toast Notification helper
  const addToast = (title: string, description?: string, type: ToastItem["type"] = "success") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, title, description, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }

  // Load configuration from local storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedProfile = localStorage.getItem("founder_profile_data")
      if (savedProfile) {
        try {
          setProfile(JSON.parse(savedProfile))
        } catch (e) {
          console.error("Error reading cached profile", e)
        }
      }

      const savedEmail = localStorage.getItem("demo_email") || ""
      setEmail(savedEmail)

      const savedAccent = localStorage.getItem("founder_settings_accent") as keyof typeof ACCENTS
      if (savedAccent && ACCENTS[savedAccent]) {
        setAccentKey(savedAccent)
      }
    }
  }, [])

  // Sync profile edits with auto-saving simulation
  const updateProfileField = (field: keyof ProfileData, value: string | string[], nestedKey?: string) => {
    let updatedProfile: ProfileData
    if (nestedKey) {
      updatedProfile = {
        ...profile,
        [field]: {
          ...(profile[field] as unknown as Record<string, string>),
          [nestedKey]: value as string
        }
      }
    } else {
      updatedProfile = {
        ...profile,
        [field]: value
      }
    }

    setProfile(updatedProfile)
    localStorage.setItem("founder_profile_data", JSON.stringify(updatedProfile))
    if (updatedProfile.name) localStorage.setItem("demo_name", updatedProfile.name)
    if (updatedProfile.email) localStorage.setItem("demo_email", updatedProfile.email)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("founder-profile-update"))
    }

    // Trigger saving feedback
    const saveKey = nestedKey ? `${field}.${nestedKey}` : field
    setSavingKeys((prev) => ({ ...prev, [saveKey]: "saving" }))
    
    // Simulate auto-save delay
    const timeoutId = setTimeout(() => {
      setSavingKeys((prev) => ({ ...prev, [saveKey]: "saved" }))
      setTimeout(() => {
        setSavingKeys((prev) => ({ ...prev, [saveKey]: null }))
      }, 1500)
    }, 800)

    return () => clearTimeout(timeoutId)
  }

  // Save Accent Selection
  const handleAccentChange = (key: keyof typeof ACCENTS) => {
    setAccentKey(key)
    localStorage.setItem("founder_settings_accent", key)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("founder-accent-update", { detail: { accent: key } }))
    }
    addToast("Theme Accent Changed", `Interface colors set to ${ACCENTS[key].name}.`, "info")
  }

  // Auto-save toggle helper
  const handleToggleAutoSave = (
    key: string,
    stateVal: boolean,
    setVal: (v: boolean) => void,
    name: string
  ) => {
    const newVal = !stateVal
    setVal(newVal)
    setSavingKeys((prev) => ({ ...prev, [key]: "saving" }))

    setTimeout(() => {
      setSavingKeys((prev) => ({ ...prev, [key]: "saved" }))
      addToast(`${name} Updated`, `Preference saved dynamically to local nodes.`, "success")
      setTimeout(() => {
        setSavingKeys((prev) => ({ ...prev, [key]: null }))
      }, 1500)
    }, 700)
  }

  // Handle privacy option buttons
  const handlePrivacyChange = (val: string) => {
    setProfileVisibility(val)
    setSavingKeys((prev) => ({ ...prev, "privacy": "saving" }))

    setTimeout(() => {
      setSavingKeys((prev) => ({ ...prev, "privacy": "saved" }))
      addToast("Visibility Adjusted", `Profile set to ${val === "public" ? "Public Index" : val === "network" ? "Network Only" : "Private Archive"}.`, "info")
      setTimeout(() => {
        setSavingKeys((prev) => ({ ...prev, "privacy": null }))
      }, 1500)
    }, 700)
  }

  // Mock Avatar Upload
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSavingKeys((prev) => ({ ...prev, "avatar": "saving" }))
    const reader = new FileReader()
    reader.onload = () => {
      const resultStr = reader.result as string
      updateProfileField("avatarUrl", resultStr)
      addToast("Avatar Updated", "New profile photo saved.", "success")
    }
    reader.readAsDataURL(file)
  }

  const handleUpdateEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingEmail(true)
    setTimeout(() => {
      setIsUpdatingEmail(false)
      addToast("Identity Email Updated", `Credentials linked to ${email} verified successfully.`, "success")
    }, 1200)
  }

  const handleUpdatePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingPassword(true)
    setTimeout(() => {
      setIsUpdatingPassword(false)
      setCurrentPassword("")
      setNewPassword("")
      addToast("Security Key Replaced", "Password hash has been rotated on peer networks.", "success")
    }, 1500)
  }

  // Revoke device session animation
  const handleRevokeSession = (id: string, deviceName: string) => {
    setRevokingId(id)
    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setRevokingId(null)
      addToast("Node Key Terminated", `Session credentials for '${deviceName}' revoked successfully.`, "warning")
    }, 1200)
  }

  // Simulated Wipe Terminal Sequence
  const handleDeleteAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (confirmEmail !== email) return

    setIsDeleting(true)
    setWipeLogs(["[SYSTEM] Initiating full system scrub sequence..."])

    const sequence = [
      { text: "[CRYPTO] Loading cryptographic keys...", delay: 400 },
      { text: "[PEERS] Requesting authorization from multi-sig node list... Done.", delay: 800 },
      { text: "[WIPE] Purging local cached databases (founder_profile)... Done.", delay: 1200 },
      { text: "[WIPE] Destroying identity private encryption key... Done.", delay: 1600 },
      { text: "[SYNC] Broad-scattering identity revocation to main chain... Done.", delay: 2000 },
      { text: "[SUCCESS] Wiping sequence completed. Connection closed.", delay: 2400 },
    ]

    sequence.forEach((step) => {
      setTimeout(() => {
        setWipeLogs((prev) => [...prev, step.text])
      }, step.delay)
    })

    setTimeout(() => {
      setIsDeleting(false)
      setIsDeleteOpen(false)
      setConfirmEmail("")
      setWipeLogs([])
      // Clear local storage keys
      localStorage.removeItem("founder_profile_data")
      localStorage.removeItem("founder_settings_accent")
      localStorage.removeItem("founder_milestones")
      localStorage.removeItem("problems_list")
      localStorage.removeItem("founder_your_ideas")
      localStorage.removeItem("founder_discover_ideas")
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      logout()
      router.push("/login")
      addToast("Developer Node Destroyed", "All configurations and keys permanently wiped.", "error")
    }, 2800)
  }

  // Password strength validation helper
  const getPasswordStrength = () => {
    if (!newPassword) return { score: 0, text: "Unentered", color: "bg-foreground/15", checks: { len: false, num: false, spec: false, case: false } }
    
    const checks = {
      len: newPassword.length >= 8,
      num: /\d/.test(newPassword),
      spec: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
      case: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword),
    }

    const passedCount = Object.values(checks).filter(Boolean).length
    const score = (passedCount / 4) * 100

    let text = "Weak"
    let color = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
    if (passedCount === 3) {
      text = "Medium"
      color = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
    } else if (passedCount === 4) {
      text = "Strong"
      color = "bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
    }

    return { score, text, color, checks }
  }

  const { score, text: strengthText, color: strengthColor, checks } = getPasswordStrength()

  const tabsList = [
    { key: "profile" as const, label: "Profile & Privacy", icon: Shield },
    { key: "notifications" as const, label: "Notifications", icon: Bell },
    { key: "security" as const, label: "Credentials & Key", icon: Key },
    { key: "billing" as const, label: "Plans & Billing", icon: Wallet },
    { key: "danger" as const, label: "Danger Zone", icon: Trash2 },
  ]

  const getInitials = (n: string) => {
    return n
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 relative">
      
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 w-[330px] rounded-xl bg-background/85 border border-border/10 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300 relative overflow-hidden"
          >
            {/* Countdown progress line */}
            <div className={cn("absolute bottom-0 left-0 h-[2px] w-full animate-out fade-out fill-mode-forwards origin-left", 
              t.type === "success" ? "bg-emerald-500" : t.type === "warning" ? "bg-amber-500" : t.type === "error" ? "bg-red-500" : "bg-blue-500"
            )} style={{ animationDuration: "4.5s", animationName: "shrinkProgress" }} />
            
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />}
              {t.type === "warning" && <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />}
              {t.type === "error" && <AlertTriangle className="h-4.5 w-4.5 text-red-500" />}
              {t.type === "info" && <CheckCircle2 className="h-4.5 w-4.5 text-blue-400" />}
            </div>
            <div className="flex-1 space-y-0.5">
              <h5 className="text-xs font-bold text-foreground font-mono uppercase tracking-wider">{t.title}</h5>
              {t.description && <p className="text-[11px] text-foreground/50 leading-relaxed font-sans">{t.description}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-foreground/20 hover:text-foreground/50 cursor-pointer shrink-0 transition"
              aria-label="Close Notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 pb-2 border-b border-border/[0.03]">
        <h2 className="text-2xl font-serif font-light text-foreground leading-tight">Settings</h2>
        <p className="text-foreground/40 text-xs font-sans font-light leading-relaxed">Personalize your identity aesthetic, configure visibility nodes, manage credentials, and set notification thresholds.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 mt-8 items-start">
        
        {/* Left Side: Sidebar Control & Accent Choice */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-1">
            {tabsList.map((t) => {
              const TabIcon = t.icon
              const isActive = activeTab === t.key
              return (
                <button
                   key={t.key}
                   onClick={() => setActiveTab(t.key)}
                   className={cn(
                     "w-full rounded-xl px-4 py-3 text-left transition-all duration-300 relative flex items-center gap-3 border border-transparent text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer",
                     isActive
                       ? "bg-foreground/[0.06] border-border/10 text-foreground shadow"
                       : "text-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.01]"
                   )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-[2px] bg-brand-accent rounded-r-full" />
                  )}
                  <TabIcon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-brand-accent" : "text-foreground/30")} />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* System Accent Selection widget */}
          <div className="border-t border-border/5 pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-foreground/40" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground/50">Palette Accent</span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(ACCENTS) as Array<keyof typeof ACCENTS>).map((key) => {
                const accent = ACCENTS[key]
                const isSelected = accentKey === key
                return (
                  <button
                    key={key}
                    onClick={() => handleAccentChange(key)}
                    className={cn(
                      "size-8 rounded-full border grid place-items-center transition-all duration-300 relative cursor-pointer hover:scale-105 active:scale-95",
                      isSelected 
                        ? "border-border ring-2 ring-offset-2 ring-offset-background" 
                        : "border-border/20 bg-transparent"
                    )}
                    style={isSelected ? { ["--tw-ring-color" as any]: accent.color } : undefined}
                    title={accent.name}
                  >
                    <div className="size-4.5 rounded-full" style={{ backgroundColor: accent.color }} />
                    {isSelected && (
                      <Check className="h-3 w-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 stroke-[3]" style={{ color: accent.color }} />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-foreground/30 leading-normal font-mono uppercase tracking-wider">
              Selected: <span className="text-foreground/70">{activeAccent.name}</span>
            </p>
          </div>
        </div>

        {/* Right Side: Tab Contents Panel */}
        <div className="lg:col-span-9 lg:border-l lg:border-border/10 lg:pl-10 lg:pt-1 min-h-[500px]">
          
          {activeTab === "profile" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:divide-x xl:divide-white/5 items-start">
              
              {/* Profile Config Inputs */}
              <div className="xl:col-span-7 space-y-12">
                <div className="space-y-6">
                  <div className="border-b border-border/5 pb-4">
                    <h3 className="text-sm font-serif font-light text-foreground flex items-center gap-2">
                      <User className="h-4 w-4" style={{ color: activeAccent.color }} />
                      Developer Identity Attributes
                    </h3>
                    <p className="text-foreground/40 text-[11px] mt-1 font-mono uppercase tracking-wider">Edit your public card profile parameters</p>
                  </div>

                  {/* Avatar Upload Selection Grid */}
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Avatar Node Image</label>
                      {savingKeys["avatarUrl"] && (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          {savingKeys["avatarUrl"] === "saving" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                          {savingKeys["avatarUrl"] === "saving" ? "saving..." : "saved"}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Current Avatar Circle */}
                      <div className="size-16 rounded-full overflow-hidden border border-border/10 shrink-0 bg-foreground/5 flex items-center justify-center relative group">
                        {profile.avatarUrl ? (
                          profile.avatarUrl.startsWith("linear-gradient") ? (
                            <div className="size-full" style={{ background: profile.avatarUrl }} />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.avatarUrl} alt="Avatar" className="size-full object-cover" />
                          )
                        ) : (
                          <span className="text-lg font-bold font-mono text-foreground/60">{getInitials(profile.name)}</span>
                        )}
                        
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          aria-label="Upload custom image"
                        >
                          <Camera className="h-4 w-4 text-foreground" />
                        </button>
                      </div>

                      {/* Presets List */}
                      <div className="space-y-1.5 flex-1 min-w-[180px]">
                        <span className="text-[11px] font-mono text-foreground/35 uppercase tracking-wide">Pick Gradient Preset</span>
                        <div className="flex gap-2">
                          {PRESET_AVATARS.map((gradient, i) => (
                            <button
                              key={i}
                              onClick={() => updateProfileField("avatarUrl", gradient)}
                              className={cn(
                                "size-8 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95",
                                profile.avatarUrl === gradient
                                  ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                                  : "ring-1 ring-border/20"
                              )}
                              style={{
                                background: gradient,
                                ...(profile.avatarUrl === gradient
                                  ? { boxShadow: "0 0 0 2px var(--brand-accent)" }
                                  : {})
                              }}
                              aria-label={`Gradient Preset ${i + 1}`}
                            />
                          ))}
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="size-8 rounded-full border border-border/10 hover:border-border/30 bg-foreground/5 flex items-center justify-center cursor-pointer transition"
                            title="Upload custom image"
                          >
                            <Camera className="h-3.5 w-3.5 text-foreground/50" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                    />
                  </div>

                  {/* Input Fields with dynamic indicators */}
                  <div className="space-y-4">
                    {/* Display Name */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label htmlFor="display-name" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Display Name</label>
                        {savingKeys["name"] && (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                            {savingKeys["name"] === "saving" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                            {savingKeys["name"] === "saving" ? "saving..." : "saved"}
                          </span>
                        )}
                      </div>
                      <Input
                        id="display-name"
                        value={profile.name}
                        onChange={(e) => updateProfileField("name", e.target.value)}
                        className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                      />
                      <p className="text-[11px] text-foreground/30 font-sans mt-1">Your display name as it appears on cohort directories.</p>
                    </div>

                    {/* Headline */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label htmlFor="headline" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Headline Role</label>
                        {savingKeys["headline"] && (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                            {savingKeys["headline"] === "saving" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                            {savingKeys["headline"] === "saving" ? "saving..." : "saved"}
                          </span>
                        )}
                      </div>
                      <Input
                        id="headline"
                        value={profile.headline}
                        onChange={(e) => updateProfileField("headline", e.target.value)}
                        className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                      />
                      <p className="text-[11px] text-foreground/30 font-sans mt-1">A one-line description of your project role (e.g. Lead Engineer, AI Architect).</p>
                    </div>

                    {/* Location */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label htmlFor="location" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Node Location</label>
                        {savingKeys["location"] && (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                            {savingKeys["location"] === "saving" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                            {savingKeys["location"] === "saving" ? "saving..." : "saved"}
                          </span>
                        )}
                      </div>
                      <Input
                        id="location"
                        value={profile.location}
                        onChange={(e) => updateProfileField("location", e.target.value)}
                        className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                      />
                      <p className="text-[11px] text-foreground/30 font-sans mt-1">Your base city or remote status for connection searches.</p>
                    </div>

                    {/* Biography */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label htmlFor="biography" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Bio Synopsis</label>
                        {savingKeys["about"] && (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                            {savingKeys["about"] === "saving" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                            {savingKeys["about"] === "saving" ? "saving..." : "saved"}
                          </span>
                        )}
                      </div>
                      <Textarea
                        id="biography"
                        value={profile.about}
                        onChange={(e) => updateProfileField("about", e.target.value)}
                        className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg min-h-[90px] focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                      />
                      <p className="text-[11px] text-foreground/30 font-sans mt-1">A brief background summary introducing yourself to cohort investors.</p>
                    </div>
                  </div>
                </div>

                {/* Profile Privacy Rules */}
                <div className="space-y-6 pt-6 border-t border-border/5">
                  <div className="border-b border-border/5 pb-4">
                    <h3 className="text-sm font-serif font-light text-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" style={{ color: activeAccent.color }} />
                      Decentralized Privacy Rules
                    </h3>
                    <p className="text-foreground/40 text-[11px] mt-1 font-mono uppercase tracking-wider">Configure search visibility and credential disclosures</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Index Visibility Rule</label>
                        {savingKeys["privacy"] && (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                            {savingKeys["privacy"] === "saving" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                            {savingKeys["privacy"] === "saving" ? "saving..." : "saved"}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { value: "public", label: "Public", icon: Globe },
                          { value: "network", label: "Network", icon: Users },
                          { value: "private", label: "Private", icon: Lock },
                        ].map((opt) => {
                          const isSelected = profileVisibility === opt.value
                          const OptIcon = opt.icon
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handlePrivacyChange(opt.value)}
                              className={cn(
                                "flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all w-full cursor-pointer relative",
                                isSelected
                                  ? "bg-foreground/[0.04] border-border/20 shadow-md scale-[1.01]"
                                  : "bg-background/30 border-border/5 hover:border-border/10 hover:bg-foreground/[0.01]"
                              )}
                            >
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 size-1.5 rounded-full" style={{ backgroundColor: activeAccent.color }} />
                              )}
                              <OptIcon className="h-4.5 w-4.5 mb-1.5 opacity-60" style={{ color: isSelected ? activeAccent.color : "white" }} />
                              <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-foreground/80">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="border-t border-border/[0.04] pt-4.5 space-y-3.5">
                      <AutoSaveRow
                        id="show-email"
                        label="Publish Email Address"
                        desc="Expose address metadata to verified investors matching nodes."
                        checked={showEmail}
                        status={savingKeys["show-email"]}
                        onToggle={() => handleToggleAutoSave("show-email", showEmail, setShowEmail, "Email Visibility")}
                        activeAccent={activeAccent}
                      />
                      <AutoSaveRow
                        id="allow-messages"
                        label="Direct Connection rules"
                        desc="Allow cohort matching requests to open peer-to-peer chats immediately."
                        checked={allowMessages}
                        status={savingKeys["allow-messages"]}
                        onToggle={() => handleToggleAutoSave("allow-messages", allowMessages, setAllowMessages, "Direct Connections")}
                        activeAccent={activeAccent}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Reactive Live Preview Card (xl:col-span-5) */}
              <div className="xl:col-span-5 xl:sticky xl:top-6 space-y-4 xl:pl-8">
                <div className="text-[11px] font-mono font-semibold uppercase tracking-widest text-foreground/40 flex items-center gap-1.5 px-1.5">
                  <Eye className="h-3.5 w-3.5 text-foreground/40" />
                  Live Preview Mockup
                </div>
                
                <div 
                  className="bg-background border border-border/5 text-foreground rounded-xl overflow-hidden relative"
                >
                  <div className="p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="size-16 rounded-full overflow-hidden border border-border/10 shrink-0 bg-foreground/5 flex items-center justify-center relative shadow-md">
                          {profile.avatarUrl ? (
                            profile.avatarUrl.startsWith("linear-gradient") ? (
                              <div className="size-full" style={{ background: profile.avatarUrl }} />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={profile.avatarUrl} alt="Preview Avatar" className="size-full object-cover" />
                            )
                          ) : (
                            <span className="text-base font-bold font-mono text-foreground/50">{getInitials(profile.name)}</span>
                          )}
                        </div>

                        {/* Header details */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-serif font-light text-sm text-foreground truncate">{profile.name || "Unnamed Node"}</h4>
                            <Badge className="bg-brand-accent/10 text-brand-accent border-brand-accent/20 text-[11px] tracking-wide rounded-full scale-90 origin-left shrink-0">
                              Verified
                            </Badge>
                          </div>
                          <p className="text-foreground/70 text-xs truncate leading-normal">{profile.headline || "No Headline Role"}</p>
                          <p className="text-[11px] text-foreground/35 font-mono truncate">{profile.location || "No Location"}</p>
                        </div>
                      </div>

                      {/* Status pill overlay container (aligned inline on top right) */}
                      <div className="shrink-0 sm:pt-1">
                        <Badge className={cn("text-[11px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border border-border/5",
                          profileVisibility === "public" ? "bg-brand-accent/10 text-brand-accent" :
                          profileVisibility === "network" ? "bg-indigo-500/10 text-indigo-400" :
                          "bg-pink-500/10 text-pink-400"
                        )}>
                          {profileVisibility === "public" && "Public Node"}
                          {profileVisibility === "network" && "Network Restricted"}
                          {profileVisibility === "private" && "Private Node"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {/* Bio */}
                      <p className="text-[10.5px] text-foreground/50 leading-relaxed font-sans line-clamp-3 bg-foreground/[0.015] border border-border/5 rounded-lg p-2.5">
                        {profile.about || "Enter details in settings to populate biography info..."}
                      </p>

                      {/* Dynamic Badge Features */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {showEmail && (
                          <div className="flex items-center gap-1 bg-foreground/5 border border-border/5 px-2 py-0.5 rounded text-[11px] font-mono text-foreground/60">
                            <Mail className="h-2.5 w-2.5 text-brand-accent" /> {email}
                          </div>
                        )}
                        <div className="flex items-center gap-1 bg-foreground/5 border border-border/5 px-2 py-0.5 rounded text-[11px] font-mono text-foreground/60">
                          <Shield className="h-2.5 w-2.5" style={{ color: activeAccent.color }} /> {allowMessages ? "Open Connections" : "Strict Matching"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Notification Settings */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="border-b border-border/5 pb-4">
                <h3 className="text-sm font-serif font-light text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4" style={{ color: activeAccent.color }} />
                  Alert Notification Channels
                </h3>
                <p className="text-foreground/40 text-[11px] mt-1 font-mono uppercase tracking-wider">Configure real-time notifications and weekly cohorts digests</p>
              </div>

              <div className="space-y-3.5 pt-1">
                <AutoSaveRow
                  id="email-notifications"
                  label="Email System Alerts"
                  desc="Receive escrow milestone warnings and platform governance updates."
                  checked={emailNotifications}
                  status={savingKeys["email-notifications"]}
                  onToggle={() => handleToggleAutoSave("email-notifications", emailNotifications, setEmailNotifications, "Email Notifications")}
                  activeAccent={activeAccent}
                />
                <AutoSaveRow
                  id="push-notifications"
                  label="Browser push notifications"
                  desc="Display real-time desktop banners when matches drop direct messages."
                  checked={pushNotifications}
                  status={savingKeys["push-notifications"]}
                  onToggle={() => handleToggleAutoSave("push-notifications", pushNotifications, setPushNotifications, "Push Alerts")}
                  activeAccent={activeAccent}
                />
                <AutoSaveRow
                  id="weekly-digest"
                  label="Weekly convictions digest"
                  desc="Receive a compiled report detailing index changes, investor logs, and trends."
                  checked={weeklyDigest}
                  status={savingKeys["weekly-digest"]}
                  onToggle={() => handleToggleAutoSave("weekly-digest", weeklyDigest, setWeeklyDigest, "Weekly Cohorts Digest")}
                  activeAccent={activeAccent}
                />
                <AutoSaveRow
                  id="funding-updates"
                  label="Milestone Escrow Updates"
                  desc="Receive instant cryptographic signals regarding escrow release or pooling updates."
                  checked={fundingUpdates}
                  status={savingKeys["funding-updates"]}
                  onToggle={() => handleToggleAutoSave("funding-updates", fundingUpdates, setFundingUpdates, "Milestone Escrow")}
                  activeAccent={activeAccent}
                />
                <AutoSaveRow
                  id="team-updates"
                  label="Cohort membership warnings"
                  desc="Get notified of network revisions made by project creators."
                  checked={teamUpdates}
                  status={savingKeys["team-updates"]}
                  onToggle={() => handleToggleAutoSave("team-updates", teamUpdates, setTeamUpdates, "Cohort Warnings")}
                  activeAccent={activeAccent}
                />
              </div>
            </div>
          )}

          {/* TAB 3: Credentials & Security (Strength indicators, audit log) */}
          {activeTab === "security" && (
            <div className="space-y-12">
              
              {/* Profile Verification & Primary Email */}
              <div className="space-y-6">
                <div className="border-b border-border/5 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-serif font-light text-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" style={{ color: activeAccent.color }} />
                      Identity Authorization Email
                    </h3>
                    <p className="text-foreground/40 text-[11px] mt-1 font-mono uppercase tracking-wider">Manage your principal identity login certificate</p>
                  </div>
                  <Badge className="bg-brand-accent/10 text-brand-accent border-brand-accent/20 flex items-center gap-1.5 py-0.5 px-3 rounded-full font-mono text-[11px]">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Principal
                  </Badge>
                </div>

                <form onSubmit={handleUpdateEmailSubmit} className="flex gap-3 max-w-md items-end pt-1">
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="sec-email" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Registered Email</label>
                    <Input
                      id="sec-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 pr-3 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isUpdatingEmail || email.trim() === "alex@edgevisionlabs.com"}
                    className={cn(
                      "h-9 px-4.5 rounded-lg text-xs font-semibold tracking-wider font-mono cursor-pointer shrink-0 transition-all active:scale-[0.98]",
                      email.trim() !== "alex@edgevisionlabs.com"
                        ? activeAccent.btnBg
                        : "bg-foreground/5 text-foreground/30 border border-border/5 cursor-not-allowed"
                    )}
                  >
                    {isUpdatingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify Identity"}
                  </Button>
                </form>
              </div>

              {/* Password update & Strength Checker */}
              <div className="space-y-6 pt-6 border-t border-border/5">
                <div className="border-b border-border/5 pb-4">
                  <h3 className="text-sm font-serif font-light text-foreground flex items-center gap-2">
                    <Key className="h-4 w-4" style={{ color: activeAccent.color }} />
                    Credential Key Rotation
                  </h3>
                  <p className="text-foreground/40 text-[11px] mt-1 font-mono uppercase tracking-wider">Change the secure keys protecting node configuration</p>
                </div>

                <form onSubmit={handleUpdatePasswordSubmit} className="space-y-5 max-w-lg pt-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Current password */}
                    <div className="space-y-1.5">
                      <label htmlFor="cur-pass" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">Current Password</label>
                      <div className="relative">
                        <Input
                          id="cur-pass"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 pr-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 cursor-pointer"
                          aria-label="Toggle Current Password"
                        >
                          {showCurrentPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* New password */}
                    <div className="space-y-1.5">
                      <label htmlFor="new-pass" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">New Password Key</label>
                      <div className="relative">
                        <Input
                          id="new-pass"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 pr-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 cursor-pointer"
                          aria-label="Toggle New Password"
                        >
                          {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Strength Checklist */}
                  {newPassword && (
                    <div className="bg-background/20 border border-border/5 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between text-[11px] font-mono font-semibold uppercase tracking-wider">
                        <span className="text-foreground/40">Credential Strength</span>
                        <span className="text-foreground">{strengthText}</span>
                      </div>
                      
                      <Progress value={score} className="h-1.5 bg-foreground/5" indicatorClassName={strengthColor} />
                      
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-foreground/40">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("size-2 rounded-full", checks.len ? "bg-emerald-500" : "bg-foreground/10")} />
                          <span>8+ Characters</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={cn("size-2 rounded-full", checks.num ? "bg-emerald-500" : "bg-foreground/10")} />
                          <span>Includes Number</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={cn("size-2 rounded-full", checks.spec ? "bg-emerald-500" : "bg-foreground/10")} />
                          <span>Special Symbol</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={cn("size-2 rounded-full", checks.case ? "bg-emerald-500" : "bg-foreground/10")} />
                          <span>Mixed Case Letters</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isUpdatingPassword || !currentPassword || !newPassword || score < 75}
                    className={cn(
                      "h-9 px-5 rounded-lg text-xs font-semibold tracking-wider font-mono cursor-pointer transition-all active:scale-[0.98]",
                      currentPassword && newPassword && score >= 75
                        ? activeAccent.btnBg
                        : "bg-foreground/5 text-foreground/30 border border-border/5 cursor-not-allowed"
                    )}
                  >
                    {isUpdatingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Update Password Key
                  </Button>
                </form>
              </div>

              {/* Active Session Audit Trail */}
              <div className="space-y-6 pt-6 border-t border-border/5">
                <div className="border-b border-border/5 pb-4">
                  <h3 className="text-sm font-serif font-light text-foreground flex items-center gap-2">
                    <Laptop className="h-4 w-4" style={{ color: activeAccent.color }} />
                    Authorized Access Sessions & Nodes
                  </h3>
                  <p className="text-foreground/40 text-[11px] mt-1 font-mono uppercase tracking-wider">Review active sync credentials linked to this developer</p>
                </div>

                <div className="space-y-2.5 pt-1">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-xl border border-border/5 bg-background/20 p-4 transition-all duration-300",
                        revokingId === s.id ? "opacity-40 scale-[0.98]" : "hover:bg-background/30"
                      )}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="size-9 rounded-lg bg-foreground/5 border border-border/10 flex items-center justify-center shrink-0">
                          {s.device.includes("MacBook") && <Laptop className="h-4.5 w-4.5 text-foreground/60" />}
                          {s.device.includes("iPhone") && <Smartphone className="h-4.5 w-4.5 text-foreground/60" />}
                          {s.device.includes("Sync Node") && <Terminal className="h-4.5 w-4.5 text-foreground/60" />}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            {s.device}
                            {s.active && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] py-0 px-2 uppercase rounded-full scale-90">
                                Active Node
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-foreground/40 font-mono leading-none">{s.browser} • {s.location}</p>
                          <p className="text-[11px] text-foreground/30 font-sans tracking-wide leading-none">{s.time}</p>
                        </div>
                      </div>

                      {!s.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeSession(s.id, s.device)}
                          disabled={revokingId === s.id}
                          className="h-8 rounded-lg text-[11px] font-mono uppercase tracking-wider text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/30 hover:bg-red-500/5 bg-transparent cursor-pointer shrink-0 transition"
                        >
                          {revokingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Revoke"}
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {sessions.length === 1 && (
                    <p className="text-[11px] text-foreground/20 font-mono text-center pt-2">No other active login nodes found.</p>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Plans & Billing */}
          {activeTab === "billing" && (
            <div className="space-y-6" id="billing-section">
              <div className="border-b border-border/[0.03] pb-4">
                <h3 className="text-sm font-serif font-light text-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  Plans & Subscription Billing
                </h3>
                <p className="text-muted-foreground text-[11px] mt-1 font-mono uppercase tracking-wider">Configure workspace membership level and resource limits</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    key: "free",
                    name: "Free Tier",
                    price: "$0",
                    tagline: "Basic workspace & community metrics.",
                    features: ["Post up to 2 startup ideas", "Problem board access", "Verified identity badge"],
                    color: "#8EA38E"
                  },
                  {
                    key: "something",
                    name: "Something Plan",
                    price: "$49/mo",
                    tagline: "Standard escrow & matching features.",
                    features: ["Unlimited idea submissions", "Milestone escrow tool", "Digital NDA signatures", "Chat category filters"],
                    color: "#E3C27A"
                  },
                  {
                    key: "nothing",
                    name: "Nothing Plan",
                    price: "$199/mo",
                    tagline: "Full AI simulation & priority operator intro.",
                    features: ["Mutiny AI skeptic stress-testing", "Assume Nothing AI diagnostics", "Unlimited diligence auditing", "Priority investor match list"],
                    color: "#C88E72"
                  }
                ].map((plan) => {
                  const isCurrent = selectedPlan === plan.key
                  return (
                    <div
                      key={plan.key}
                      className={cn(
                        "rounded-xl border p-5 flex flex-col justify-between transition-all duration-300 relative bg-background/25 backdrop-blur-xl",
                        isCurrent ? "border-foreground/45 shadow" : "border-border/30 hover:border-border/60 hover:bg-accent/10"
                      )}
                    >
                      {isCurrent && (
                        <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-foreground text-background text-[11px] uppercase tracking-wider font-mono font-bold">
                          Active Plan
                        </div>
                      )}
                      <div className="space-y-3">
                        <div className="flex items-baseline justify-between">
                          <h4 className="text-xs font-bold" style={{ color: plan.color }}>{plan.name}</h4>
                          <span className="text-xs font-bold font-mono">{plan.price}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal font-sans">{plan.tagline}</p>
                        
                        <div className="border-t border-border/10 pt-3">
                          <ul className="space-y-1.5 text-[11px] text-foreground/75 leading-relaxed font-sans">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-6 pt-2">
                        <Button
                          disabled={isCurrent}
                          onClick={() => handlePlanUpgrade(plan.key)}
                          className={cn(
                            "w-full text-[11px] font-bold uppercase tracking-wider font-mono h-8 rounded-lg cursor-pointer transition",
                            isCurrent
                              ? "bg-accent/40 text-muted-foreground border border-border/40"
                              : "bg-foreground text-background hover:bg-foreground/90"
                          )}
                        >
                          {isCurrent ? "Current Plan" : `Select ${plan.name.split(" ")[0]}`}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Danger Zone */}
          {activeTab === "danger" && (
            <div className="space-y-6">
              <div className="border-b border-destructive/10 pb-4">
                <h3 className="text-sm font-serif font-light text-destructive flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  Developer Node Deletion Protocol
                </h3>
                <p className="text-destructive/50 text-[11px] mt-1 font-mono uppercase tracking-wider">Wipe cryptographics secrets and disconnect cohort escrows</p>
              </div>

              <div className="rounded-xl border border-destructive/20 bg-destructive/[0.02] p-4.5 space-y-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    Wipe Node Key Identity
                  </div>
                  <p className="text-[11px] text-foreground/50 leading-relaxed font-sans">
                    Permanently delete your profile data caches, matching statistics, authorized node connections, and private message logs. Wiping node certificates is destructive and completely irreversible.
                  </p>
                </div>

                <Button
                  onClick={() => setIsDeleteOpen(true)}
                  className="bg-transparent border border-destructive/30 hover:border-destructive/60 text-destructive hover:bg-destructive/10 rounded-lg text-xs font-semibold font-mono tracking-wider h-9 px-4.5 transition-all cursor-pointer"
                >
                  Initiate Deletion Protocol
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Account Deletion Dialog Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => !isDeleting && setIsDeleteOpen(open)}>
        <DialogContent className="bg-popover/95 border border-destructive/20 text-foreground backdrop-blur-2xl rounded-2xl max-w-md shadow-2xl p-6">
          <DialogHeader className="border-b border-border/5 pb-3">
            <DialogTitle className="text-base font-serif font-light text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-destructive animate-pulse" /> Confirm Identity Wipe
            </DialogTitle>
            <DialogDescription className="text-foreground/40 text-xs mt-1 leading-normal">
              You are about to execute node key destruction. Fill credentials below to verify matching sectors.
            </DialogDescription>
          </DialogHeader>

          {/* Interactive Wipe logs console */}
          {isDeleting ? (
            <div className="space-y-2 pt-2.5">
              <span className="text-[11px] font-mono text-destructive uppercase tracking-widest flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Destroying Sectors...
              </span>
              <div className="bg-background/90 p-4 border border-border/5 rounded-lg font-mono text-[11px] text-foreground/70 h-36 overflow-y-auto space-y-1">
                {wipeLogs.map((log, index) => (
                  <div key={index} className={cn(log.includes("SUCCESS") ? "text-emerald-400" : log.includes("SYSTEM") ? "text-blue-400" : "text-foreground/60")}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleDeleteAccountSubmit} className="space-y-4 pt-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/[0.02] p-3 text-[11px] text-destructive/80 leading-relaxed font-mono">
                WARNING: Cryptographic credentials will be revoked. Pending milestone escrows will be frozen.
              </div>

              <div className="space-y-1.5">
                <label htmlFor="wipe-confirm" className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground/50">
                  Type your email to confirm: <span className="text-foreground font-bold select-all">alex@edgevisionlabs.com</span>
                </label>
                <Input
                  id="wipe-confirm"
                  type="email"
                  placeholder="alex@edgevisionlabs.com"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 pr-3 focus-visible:ring-destructive/20 focus-visible:border-destructive/40"
                  required
                />
              </div>

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteOpen(false)
                    setConfirmEmail("")
                  }}
                  className="border-border/10 text-foreground hover:bg-foreground/5 text-xs font-semibold rounded-lg h-8 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isDeleting || confirmEmail !== "alex@edgevisionlabs.com"}
                  className={cn(
                    "rounded-lg text-xs font-semibold font-mono tracking-wider h-8 px-4 transition-all cursor-pointer",
                    confirmEmail === "alex@edgevisionlabs.com"
                      ? "bg-destructive text-destructive-foreground hover:opacity-90 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                      : "bg-destructive/10 text-destructive/40 border border-destructive/20 cursor-not-allowed"
                  )}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Confirm Wipe
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Visual auto-saving row component
interface AutoSaveRowProps {
  id: string
  label: string
  desc?: string
  checked: boolean
  status?: "saving" | "saved" | null
  onToggle: () => void
  activeAccent: typeof ACCENTS[keyof typeof ACCENTS]
}

function AutoSaveRow({ id, label, desc, checked, status, onToggle, activeAccent }: AutoSaveRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/5 bg-background/20 p-4 transition hover:bg-background/30">
      <div className="min-w-0 space-y-0.5">
        <div className="font-semibold text-xs text-foreground font-mono uppercase tracking-wide flex items-center gap-2">
          {label}
          {status && (
            <span className="text-[11px] font-mono lowercase font-normal flex items-center gap-1">
              {status === "saving" ? (
                <span className="text-foreground/40 flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> saving...
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <Check className="h-2.5 w-2.5" /> saved
                </span>
              )}
            </span>
          )}
        </div>
        {desc && <p className="text-[11px] text-foreground/40 leading-normal font-sans">{desc}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        aria-label={label}
        id={`${id}-switch`}
        className={cn("shrink-0 cursor-pointer", activeAccent.toggleBg)}
      />
    </div>
  )
}