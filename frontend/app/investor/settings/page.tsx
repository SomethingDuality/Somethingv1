"use client"

import { useState, useEffect } from "react"
import { useAvatar } from "@/components/avatar-context"
import { AvatarUploader } from "@/components/avatar-uploader"
import apiClient from "@/lib/axios"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Bell, Shield, CreditCard, Trash2, ChevronRight, Palette, Check, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "notifications" | "privacy" | "account" | "billing" | "danger"

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "notifications", label: "Notifications",    icon: Bell       },
  { key: "privacy",       label: "Privacy",          icon: Shield     },
  { key: "account",       label: "Account",          icon: CreditCard },
  { key: "billing",       label: "Plans & Billing",  icon: Wallet     },
  { key: "danger",        label: "Danger Zone",      icon: Trash2     },
]

const ACCENTS = {
  emerald: {
    name: "Console Sage",
    text: "text-[#8EA38E]",
    bg: "bg-[#8EA38E]",
    border: "border-[#8EA38E]/25",
    color: "#8EA38E",
  },
  indigo: {
    name: "Tactile Chalk",
    text: "text-[#E2DFD5]",
    bg: "bg-[#E2DFD5]",
    border: "border-[#E2DFD5]/25",
    color: "#E2DFD5",
  },
  violet: {
    name: "Anodized Steel",
    text: "text-[#8293A4]",
    bg: "bg-[#8293A4]",
    border: "border-[#8293A4]/25",
    color: "#8293A4",
  },
  amber: {
    name: "Earthy Copper",
    text: "text-[#C88E72]",
    bg: "bg-[#C88E72]",
    border: "border-[#C88E72]/25",
    color: "#C88E72",
  },
}

export default function InvestorSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("notifications")
  const { avatarUrl, setAvatarUrl, userName, setUserName } = useAvatar()
  const [accentKey, setAccentKey] = useState<keyof typeof ACCENTS>("emerald")

  const uploadAvatar = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const response = await apiClient.post<{ url: string }>("/investor/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setAvatarUrl(response.data.url)
      // Save details to investor profile data
      const stored = localStorage.getItem("investor_profile_data")
      const parsed = stored ? JSON.parse(stored) : {}
      parsed.avatarUrl = response.data.url
      localStorage.setItem("investor_profile_data", JSON.stringify(parsed))
      window.dispatchEvent(new CustomEvent("investor-profile-update"))
    } catch (err) {
      console.error("Error uploading avatar:", err)
      // Fallback local file URL for demo purposes
      const dummyUrl = URL.createObjectURL(file)
      setAvatarUrl(dummyUrl)
      const stored = localStorage.getItem("investor_profile_data")
      const parsed = stored ? JSON.parse(stored) : {}
      parsed.avatarUrl = dummyUrl
      localStorage.setItem("investor_profile_data", JSON.stringify(parsed))
      window.dispatchEvent(new CustomEvent("investor-profile-update"))
    }
  }

  // Sync Accent key from local storage on mount
  useEffect(() => {
    const savedAccent = localStorage.getItem("founder_settings_accent") as keyof typeof ACCENTS
    if (savedAccent && ACCENTS[savedAccent]) {
      setAccentKey(savedAccent)
    }

    const savedEmail = localStorage.getItem("demo_email") || ""
    setEmail(savedEmail)

    const savedGhost = localStorage.getItem("investor_ghost_mode") === "true"
    setGhostMode(savedGhost)

    const handleGhostChange = (e: Event) => {
      const ce = e as CustomEvent<{ ghost: boolean }>
      if (ce.detail) setGhostMode(ce.detail.ghost)
    }
    window.addEventListener("ghost-mode-change", handleGhostChange)
    return () => {
      window.removeEventListener("ghost-mode-change", handleGhostChange)
    }
  }, [])

  const handleAccentChange = (key: keyof typeof ACCENTS) => {
    setAccentKey(key)
    localStorage.setItem("founder_settings_accent", key)
    window.dispatchEvent(new CustomEvent("founder-accent-update", { detail: { accent: key } }))
  }

  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications,  setPushNotifications]  = useState(true)
  const [weeklyDigest,       setWeeklyDigest]        = useState(true)
  const [fundingUpdates,     setFundingUpdates]      = useState(true)
  const [teamUpdates,        setTeamUpdates]         = useState(true)

  // Privacy state
  const [profileVisibility, setProfileVisibility] = useState("public")
  const [showEmail,         setShowEmail]         = useState(false)
  const [allowMessages,     setAllowMessages]     = useState(true)
  const [ghostMode,         setGhostMode]         = useState(false)

  // Account state
  const [email,           setEmail]           = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword,     setNewPassword]     = useState("")
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
    alert(`Success: Switched to the "${plan.toUpperCase()}" package.`)
  }

  const handleUpdateNotifications = () => {
    console.log("Update notifications:", { emailNotifications, pushNotifications, weeklyDigest, fundingUpdates, teamUpdates })
  }
  const handleUpdatePrivacy = () => {
    console.log("Update privacy:", { profileVisibility, showEmail, allowMessages, ghostMode })
    localStorage.setItem("investor_ghost_mode", String(ghostMode))
    window.dispatchEvent(new CustomEvent("ghost-mode-change", { detail: { ghost: ghostMode } }))
  }
  const handleUpdateEmail = () => {
    console.log("Update email:", { email })
    localStorage.setItem("demo_email", email)
    window.dispatchEvent(new CustomEvent("investor-profile-update"))
  }
  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) return
    try {
      // Use the forgot-password / reset-password flow:
      // 1. Request a reset token using the current session email
      const tokenRes = await apiClient.post<{ resetToken: string }>("/auth/forgot-password", { email })
      const { resetToken } = tokenRes.data
      if (!resetToken) throw new Error("No reset token returned")
      // 2. Reset with the new password
      await apiClient.post("/auth/reset-password", { resetToken, newPassword })
      alert("Password updated successfully.")
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      console.warn("Password update failed:", err)
      alert("Password update failed. Make sure your email is correct and the new password meets requirements (8+ chars, uppercase, number, special character).")
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure? This permanently deletes your account and all associated data. This cannot be undone.")) return
    try {
      await apiClient.delete("/auth/account")
      // Clear all local state and redirect to login
      localStorage.clear()
      window.location.href = "/login"
    } catch (err) {
      console.warn("Delete account failed:", err)
      alert("Failed to delete account. Please try again.")
    }
  }

  const activeAccent = ACCENTS[accentKey] || ACCENTS.emerald

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 relative space-y-12">
      {/* Page header */}
      <div className="space-y-1 pt-2 mb-10">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-accent)" }} />
          Investor Settings
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground leading-tight">
          Preferences
        </h1>
        <p className="text-sm text-muted-foreground font-sans max-w-lg mt-1">
          Control your notifications, privacy, and account details.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-10 sm:gap-12 mt-8 items-start">
        {/* Left sidebar tabs */}
        <div className="w-full md:w-48 shrink-0 space-y-6">
          <div className="space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                id={`tab-${key}`}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg text-left transition-all cursor-pointer",
                  activeTab === key
                    ? "bg-accent font-medium text-foreground"
                    : "text-foreground/50 hover:text-foreground hover:bg-accent/50",
                  key === "danger" && activeTab === key && "text-rose-500",
                  key === "danger" && activeTab !== key && "text-rose-500/50 hover:text-rose-500"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
                {activeTab === key && (
                  <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                )}
              </button>
            ))}
          </div>

          {/* Palette Accent Selection (brought parity with founder settings) */}
          <div className="border-t border-border/10 pt-6 space-y-4">
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
                      "h-8 w-8 rounded-full border grid place-items-center transition-all duration-300 relative cursor-pointer hover:scale-105 active:scale-95",
                      isSelected
                        ? "border-border ring-2 ring-offset-2 ring-offset-background"
                        : "border-border/20 bg-transparent"
                    )}
                    style={isSelected ? { borderColor: accent.color } : undefined}
                    title={accent.name}
                  >
                    <div className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: accent.color }} />
                    {isSelected && (
                      <Check className="h-3 w-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 stroke-[3]" style={{ color: "#000" }} />
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

        {/* Right content panel */}
        <div className="flex-1 min-w-0 md:border-l md:border-border/10 md:pl-10 md:pt-1 min-h-[500px] space-y-8">

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <div className="space-y-6" id="notifications-section">
              <SectionTitle
                icon={Bell}
                title="Notification Preferences"
                desc="Choose what you want to hear about and how."
              />
              <div className="space-y-0 border border-border rounded-xl overflow-hidden">
                <SettingRow
                  id="email-notifications"
                  label="Email notifications"
                  desc="Receive important updates via email"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
                <SettingRow
                  id="push-notifications"
                  label="Push notifications"
                  desc="Get notified about messages and updates"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
                <SettingRow
                  id="weekly-digest"
                  label="Weekly digest"
                  desc="Summary of your activity and opportunities"
                  checked={weeklyDigest}
                  onCheckedChange={setWeeklyDigest}
                />
                <SettingRow
                  id="funding-updates"
                  label="Funding updates"
                  desc="Milestone events and capital release alerts"
                  checked={fundingUpdates}
                  onCheckedChange={setFundingUpdates}
                />
                <SettingRow
                  id="team-updates"
                  label="Team updates"
                  desc="Messages and updates from portfolio teams"
                  checked={teamUpdates}
                  onCheckedChange={setTeamUpdates}
                  last
                />
              </div>
              <Button
                onClick={handleUpdateNotifications}
                className="bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-sm font-medium"
                id="save-notifications-btn"
              >
                Save preferences
              </Button>
            </div>
          )}

          {/* ── Privacy ── */}
          {activeTab === "privacy" && (
            <div className="space-y-6" id="privacy-section">
              <SectionTitle
                icon={Shield}
                title="Privacy Settings"
                desc="Control who can see your profile and contact you."
              />

              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Profile visibility</p>
                <div className="flex gap-2" id="profile-visibility-group">
                  {[
                    { value: "public",  label: "Public"       },
                    { value: "network", label: "Network only" },
                    { value: "private", label: "Private"      },
                  ].map(option => (
                    <button
                      key={option.value}
                      id={`profile-visibility-${option.value}`}
                      onClick={() => setProfileVisibility(option.value)}
                      className={cn(
                        "text-xs rounded-full px-4 py-2 border transition-all font-medium cursor-pointer",
                        profileVisibility === option.value
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground"
                          : "border-border/60 text-foreground/50 hover:text-foreground hover:bg-accent"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">Public profiles are discoverable by all users.</p>
              </div>

              {/* Ghost Mode stealth browsing control */}
              <div className="border border-border rounded-xl overflow-hidden">
                <SettingRow
                  id="ghost-mode-privacy"
                  label="Ghost Mode (Stealth Browsing)"
                  desc="Browse startup ideas and founder briefs completely anonymously. Founders will not see you in their viewer metrics."
                  checked={ghostMode}
                  onCheckedChange={setGhostMode}
                />
                <SettingRow
                  id="show-email"
                  label="Show email address"
                  desc="Display your email on your public profile"
                  checked={showEmail}
                  onCheckedChange={setShowEmail}
                />
                <SettingRow
                  id="allow-messages"
                  label="Allow direct messages"
                  desc="Let other verified users contact you"
                  checked={allowMessages}
                  onCheckedChange={setAllowMessages}
                  last
                />
              </div>

              <Button
                onClick={handleUpdatePrivacy}
                className="bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-sm font-medium"
                id="save-privacy-btn"
              >
                Save privacy settings
              </Button>
            </div>
          )}

          {/* ── Account ── */}
          {activeTab === "account" && (
            <div className="space-y-8" id="account-section">
              <SectionTitle
                icon={CreditCard}
                title="Account Details"
                desc="Update your email address and change your password."
              />
              <div className="space-y-3">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Profile photo</p>
                <div className="p-4 rounded-xl border border-border/60 bg-accent/20 flex items-center justify-between">
                  <AvatarUploader
                    name={userName}
                    src={avatarUrl}
                    onChange={(file, url) => {
                      if (file) uploadAvatar(file)
                      else setAvatarUrl(url)
                    }}
                    size={64}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Investor Name</p>
                <Input
                  id="username-input"
                  type="text"
                  value={userName}
                  onChange={e => {
                    setUserName(e.target.value)
                    localStorage.setItem("demo_name", e.target.value)
                    // Also save to profile JSON
                    const stored = localStorage.getItem("investor_profile_data")
                    const parsed = stored ? JSON.parse(stored) : {}
                    parsed.name = e.target.value
                    localStorage.setItem("investor_profile_data", JSON.stringify(parsed))
                    window.dispatchEvent(new CustomEvent("investor-profile-update"))
                  }}
                  className="bg-accent/30 border-border/60 text-foreground"
                />
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Email address</p>
                <div className="flex gap-2">
                  <Input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="bg-accent/30 border-border/60 text-foreground"
                  />
                  <Button
                    onClick={handleUpdateEmail}
                    variant="outline"
                    className="border-border/60 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent shrink-0"
                    id="update-email-btn"
                  >
                    Update
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Change password</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    id="current-password-input"
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="bg-accent/30 border-border/60 text-foreground"
                  />
                  <Input
                    id="new-password-input"
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="bg-accent/30 border-border/60 text-foreground"
                  />
                </div>
                <Button
                  onClick={handleUpdatePassword}
                  variant="outline"
                  className="border-border/60 text-foreground/60 hover:bg-accent hover:text-foreground bg-transparent"
                  disabled={!currentPassword || !newPassword}
                  id="update-password-btn"
                >
                  Update password
                </Button>
              </div>

              <div className="pt-2 border-t border-border" id="account-status">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Account status</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-mono">
                    Verified
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">· Joined December 2023</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Plans & Billing ── */}
          {activeTab === "billing" && (
            <div className="space-y-6" id="billing-section">
              <SectionTitle
                icon={Wallet}
                title="Plans & Billing"
                desc="Manage your subscription, compare membership tiers, and choose your access level."
              />

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    key: "free",
                    name: "Free Tier",
                    price: "$0",
                    tagline: "Basic browsing & community metrics.",
                    features: ["Explore startup projects", "Follow problem boards", "View verified investor profiles"],
                    color: "#8EA38E"
                  },
                  {
                    key: "something",
                    name: "Something Plan",
                    price: "$49/mo",
                    tagline: "Standard escrow & matching features.",
                    features: ["Mutual NDA gating", "Category chats organization", "Escrow verification access", "Standard match algorithms"],
                    color: "#E3C27A"
                  },
                  {
                    key: "nothing",
                    name: "Nothing Plan",
                    price: "$199/mo",
                    tagline: "Full AI simulation & deep diligence.",
                    features: ["Diligence AI terminal access", "Assume Nothing AI stress-testing", "Unlimited pitch documents reviews", "Priority operator matching"],
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

          {/* ── Danger Zone ── */}
          {activeTab === "danger" && (
            <div className="space-y-6" id="danger-zone">
              <SectionTitle
                icon={Trash2}
                title="Danger Zone"
                desc="Irreversible and destructive account actions."
                danger
              />
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-3">
                <p className="text-sm font-medium text-rose-500">Delete account</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Permanently delete your account and all associated data — portfolio records, conversations, and settings. This action cannot be undone.
                </p>
                <Button
                  onClick={handleDeleteAccount}
                  variant="outline"
                  className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 bg-transparent"
                  id="delete-account-btn"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete account
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Section title ────────────────────────────────────────────────────────────
function SectionTitle({
  icon: Icon,
  title,
  desc,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  danger?: boolean
}) {
  return (
    <div className="space-y-0.5 pb-2 border-b border-border">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", danger ? "text-rose-500" : "text-muted-foreground")} />
        <h2 className={cn("text-base font-semibold tracking-tight", danger && "text-rose-500")}>{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground font-mono pl-6">{desc}</p>
    </div>
  )
}

// ── Setting row ──────────────────────────────────────────────────────────────
function SettingRow({
  id,
  label,
  desc,
  checked,
  onCheckedChange,
  last = false,
}: {
  id: string
  label: string
  desc?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  last?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-4 hover:bg-accent/20 transition-colors",
        !last && "border-b border-border/60"
      )}
      id={`${id}-row`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground mt-0.5 font-mono leading-relaxed">{desc}</div>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        id={`${id}-switch`}
        className="shrink-0 data-[state=checked]:bg-[var(--brand-accent)]"
      />
    </div>
  )
}