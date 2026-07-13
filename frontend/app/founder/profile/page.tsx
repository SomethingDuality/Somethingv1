"use client"

import { useState, useEffect, useRef } from "react"
import apiClient from "@/lib/axios"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
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
  Pencil,
  MapPin,
  Linkedin,
  Twitter,
  Globe,
  Briefcase,
  GraduationCap,
  Compass,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Save,
  Plus,
  Trash2,
  Github,
  Wallet,
  CheckCircle2,
  X,
  ChevronRight,
  Check,
  Camera
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Experience {
  role: string
  company: string
  duration: string
  description: string
}

interface Education {
  institution: string
  degree: string
  duration: string
}

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
  experience: Experience[]
  education: Education[]
  interests: string[]
  profileCompletion: number
  githubVerified?: boolean
  walletVerified?: boolean
}

const EMPTY_PROFILE: ProfileData = {
  name: '',
  avatarUrl: '',
  headline: '',
  location: '',
  isVerified: false,
  about: '',
  socials: { linkedin: '', twitter: '', website: '' },
  skills: [],
  experience: [],
  education: [],
  interests: [],
  profileCompletion: 0,
  githubVerified: false,
  walletVerified: false,
}

// Accent palette configurations (matched with settings)
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
    ring: "focus-visible:ring-[#8EA38E]/20 focus-visible:border-[#8EA38E]/30",
    color: "#8EA38E",
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
    ring: "focus-visible:ring-[#E2DFD5]/20 focus-visible:border-[#E2DFD5]/30",
    color: "#E2DFD5",
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
    ring: "focus-visible:ring-[#8293A4]/20 focus-visible:border-[#8293A4]/30",
    color: "#8293A4",
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
    ring: "focus-visible:ring-[#C88E72]/20 focus-visible:border-[#C88E72]/30",
    color: "#C88E72",
  },
}

interface ToastItem {
  id: string
  title: string
  description?: string
  type: "success" | "warning" | "info" | "error"
}

export default function FounderProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE)
  const [accentKey, setAccentKey] = useState<keyof typeof ACCENTS>("emerald")
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Modal control states
  const [editMode, setEditMode] = useState<"header" | "about" | null>(null)
  
  // Custom interactive experience modals
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [editingExpIndex, setEditingExpIndex] = useState<number | null>(null)
  const [expRole, setExpRole] = useState("")
  const [expCompany, setExpCompany] = useState("")
  const [expDuration, setExpDuration] = useState("")
  const [expDesc, setExpDesc] = useState("")

  // Custom interactive education modals
  const [eduModalOpen, setEduModalOpen] = useState(false)
  const [editingEduIndex, setEditingEduIndex] = useState<number | null>(null)
  const [eduInstitution, setEduInstitution] = useState("")
  const [eduDegree, setEduDegree] = useState("")
  const [eduDuration, setEduDuration] = useState("")

  // Simulated node connection modals
  const [verifyModalType, setVerifyModalType] = useState<"github" | "wallet" | null>(null)
  const [isVerifyingLink, setIsVerifyingLink] = useState(false)
  const [verifyLogs, setVerifyLogs] = useState<string[]>([])

  // Inputs for headers
  const [editName, setEditName] = useState("")
  const [editHeadline, setEditHeadline] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [editLinkedin, setEditLinkedin] = useState("")
  const [editTwitter, setEditTwitter] = useState("")
  const [editWebsite, setEditWebsite] = useState("")
  const [editAbout, setEditAbout] = useState("")

  // Skill & Interest Inputs
  const [newSkillText, setNewSkillText] = useState("")
  const [newInterestText, setNewInterestText] = useState("")

  const [saving, setSaving] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeAccent = ACCENTS[accentKey]

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Optimistic local preview using base64
    const reader = new FileReader()
    reader.onload = () => {
      const previewUrl = reader.result as string
      setProfile((prev) => ({ ...prev, avatarUrl: previewUrl }))
    }
    reader.readAsDataURL(file)

    // Upload to backend
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const res = await apiClient.post<{ avatarUrl: string }>("/founder/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const serverUrl = res.data.avatarUrl
      const updated = { ...profile, avatarUrl: serverUrl }
      saveProfileData(updated)
      addToast("Avatar Updated", "New profile photo saved.", "success")
    } catch (err) {
      console.warn("Avatar upload failed, keeping local preview", err)
      // Keep the base64 preview in localStorage as fallback
      const updated = { ...profile, avatarUrl: profile.avatarUrl }
      saveProfileData(updated)
      addToast("Avatar Updated", "Saved locally (server unavailable).", "info")
    }
  }

  // Add Toast Notification helper
  const addToast = (title: string, description?: string, type: ToastItem["type"] = "success") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, title, description, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }

  // Load profile — try API first, fall back to localStorage
  const fetchLocalProfile = async () => {
    if (typeof window === "undefined") return

    // Always load accent from localStorage immediately
    const savedAccent = localStorage.getItem("founder_settings_accent") as keyof typeof ACCENTS
    if (savedAccent && ACCENTS[savedAccent]) setAccentKey(savedAccent)

    try {
      const res = await apiClient.get<ProfileData>("/founder/profile")
      const apiProfile = res.data
      // Cache in localStorage so subsequent loads are instant
      localStorage.setItem("founder_profile_data", JSON.stringify(apiProfile))
      if (apiProfile.name) localStorage.setItem("demo_name", apiProfile.name)
      if (apiProfile.email) localStorage.setItem("demo_email", apiProfile.email)
      setProfile(apiProfile)
    } catch {
      // Fall back to localStorage cache
      const savedProfile = localStorage.getItem("founder_profile_data")
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile)
          const merged: ProfileData = {
            ...EMPTY_PROFILE,
            ...parsed,
            socials: { ...EMPTY_PROFILE.socials, ...(parsed.socials || {}) },
            skills:     parsed.skills     || [],
            experience: parsed.experience || [],
            education:  parsed.education  || [],
            interests:  parsed.interests  || [],
            githubVerified: parsed.githubVerified ?? false,
            walletVerified: parsed.walletVerified ?? false,
          }
          setProfile(merged)
        } catch (e) {
          console.error("Error reading cached profile", e)
        }
      }
      // If no cache, just leave the empty profile as-is
    }
  }

  useEffect(() => {
    fetchLocalProfile()
    const handleStorageChange = () => { fetchLocalProfile() }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate dynamic profile completion percentage
  const getDynamicCompletion = (data: ProfileData) => {
    let score = 0
    if (data.name && data.name !== "Unnamed Node") score += 15
    if (data.about && data.about.trim().length > 10) score += 20
    if (data.experience && (data.experience || []).length > 0) score += 20
    if (data.education && (data.education || []).length > 0) score += 15
    if (data.githubVerified) score += 15
    if (data.walletVerified) score += 15
    return Math.min(score, 100)
  }

  // Save profile — writes to localStorage immediately, syncs to API in background
  const saveProfileData = (updated: ProfileData) => {
    const finalData = {
      ...updated,
      profileCompletion: getDynamicCompletion(updated)
    }
    setProfile(finalData)
    localStorage.setItem("founder_profile_data", JSON.stringify(finalData))
    if (finalData.name) localStorage.setItem("demo_name", finalData.name)
    if (finalData.email) localStorage.setItem("demo_email", finalData.email)
    window.dispatchEvent(new Event("founder-profile-update"))

    // Background API sync — fire and forget, localStorage is the source of truth on failure
    apiClient.put("/founder/profile", {
      name:       finalData.name,
      headline:   finalData.headline,
      location:   finalData.location,
      about:      finalData.about,
      socials:    finalData.socials,
      skills:     finalData.skills,
      interests:  finalData.interests,
      experience: finalData.experience,
      education:  finalData.education,
    }).catch((err) => {
      console.warn("Profile sync to server failed, changes saved locally", err)
    })
  }

  // Open Dialog Editors
  const openEditModal = (mode: "header" | "about") => {
    setEditMode(mode)
    if (mode === "header") {
      setEditName(profile.name)
      setEditHeadline(profile.headline)
      setEditLocation(profile.location)
      setEditLinkedin(profile.socials.linkedin)
      setEditTwitter(profile.socials.twitter)
      setEditWebsite(profile.socials.website)
    } else if (mode === "about") {
      setEditAbout(profile.about)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const updated: ProfileData = { ...profile }
    if (editMode === "header") {
      updated.name     = editName
      updated.headline = editHeadline
      updated.location = editLocation
      updated.socials  = { linkedin: editLinkedin, twitter: editTwitter, website: editWebsite }
    } else if (editMode === "about") {
      updated.about = editAbout
    }

    saveProfileData(updated)   // handles both localStorage + API
    setSaving(false)
    setEditMode(null)
    addToast("Profile Updated", "Identity details saved successfully.", "success")
  }

  // Add/Edit Experience submit handlers
  const handleOpenExpModal = (index: number | null = null) => {
    if (index !== null) {
      const exp = profile.experience[index]
      setExpRole(exp.role)
      setExpCompany(exp.company)
      setExpDuration(exp.duration)
      setExpDesc(exp.description)
      setEditingExpIndex(index)
    } else {
      setExpRole("")
      setExpCompany("")
      setExpDuration("")
      setExpDesc("")
      setEditingExpIndex(null)
    }
    setExpModalOpen(true)
  }

  const handleSaveExperience = (e: React.FormEvent) => {
    e.preventDefault()
    const newExp: Experience = {
      role: expRole,
      company: expCompany,
      duration: expDuration,
      description: expDesc
    }

    const updatedExpList = [...profile.experience]
    if (editingExpIndex !== null) {
      updatedExpList[editingExpIndex] = newExp
      addToast("Experience Updated", `Modified role: '${expRole}' at ${expCompany}.`, "success")
    } else {
      updatedExpList.unshift(newExp)
      addToast("Experience Added", `Linked new role: '${expRole}' at ${expCompany}.`, "success")
    }

    saveProfileData({
      ...profile,
      experience: updatedExpList
    })
    setExpModalOpen(false)
  }

  const handleDeleteExperience = (index: number) => {
    const item = profile.experience[index]
    const updatedExpList = profile.experience.filter((_, i) => i !== index)
    saveProfileData({
      ...profile,
      experience: updatedExpList
    })
    addToast("Experience Removed", `Scrubbed role: '${item.role}' from timeline.`, "warning")
  }

  // Add/Edit Education handlers
  const handleOpenEduModal = (index: number | null = null) => {
    if (index !== null) {
      const edu = profile.education[index]
      setEduInstitution(edu.institution)
      setEduDegree(edu.degree)
      setEduDuration(edu.duration)
      setEditingEduIndex(index)
    } else {
      setEduInstitution("")
      setEduDegree("")
      setEduDuration("")
      setEditingEduIndex(null)
    }
    setEduModalOpen(true)
  }

  const handleSaveEducation = (e: React.FormEvent) => {
    e.preventDefault()
    const newEdu: Education = {
      institution: eduInstitution,
      degree: eduDegree,
      duration: eduDuration
    }

    const updatedEduList = [...profile.education]
    if (editingEduIndex !== null) {
      updatedEduList[editingEduIndex] = newEdu
      addToast("Academics Updated", `Modified credential at ${eduInstitution}.`, "success")
    } else {
      updatedEduList.unshift(newEdu)
      addToast("Academics Added", `Linked academic record: ${eduDegree} at ${eduInstitution}.`, "success")
    }

    saveProfileData({
      ...profile,
      education: updatedEduList
    })
    setEduModalOpen(false)
  }

  const handleDeleteEducation = (index: number) => {
    const item = profile.education[index]
    const updatedEduList = profile.education.filter((_, i) => i !== index)
    saveProfileData({
      ...profile,
      education: updatedEduList
    })
    addToast("Academics Removed", `Scrubbed record at ${item.institution}.`, "warning")
  }

  // Add Skills tag input helpers
  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const tag = newSkillText.trim()
      if (!tag) return
      
      if (profile.skills.includes(tag)) {
        addToast("Duplicate Tag", `'${tag}' is already listed in expertise list.`, "warning")
        setNewSkillText("")
        return
      }

      const updated = [...profile.skills, tag]
      saveProfileData({ ...profile, skills: updated })
      setNewSkillText("")
      addToast("Expertise Added", `Listed tag '${tag}'.`, "success")
    }
  }

  const handleRemoveSkill = (tag: string) => {
    const updated = profile.skills.filter((t) => t !== tag)
    saveProfileData({ ...profile, skills: updated })
    addToast("Expertise Removed", `Scrubbed tag '${tag}'.`, "warning")
  }

  // Add Interests tag input helpers
  const handleAddInterest = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const tag = newInterestText.trim()
      if (!tag) return

      if (profile.interests.includes(tag)) {
        addToast("Duplicate Tag", `'#${tag}' is already listed in interests.`, "warning")
        setNewInterestText("")
        return
      }

      const updated = [...profile.interests, tag]
      saveProfileData({ ...profile, interests: updated })
      setNewInterestText("")
      addToast("Interest Linked", `Linked interest #${tag}.`, "success")
    }
  }

  const handleRemoveInterest = (tag: string) => {
    const updated = profile.interests.filter((t) => t !== tag)
    saveProfileData({ ...profile, interests: updated })
    addToast("Interest Removed", `Scrubbed interest #${tag}.`, "warning")
  }

  // Simulated Connection Action
  const handleStartSimulatedVerify = (type: "github" | "wallet") => {
    setVerifyModalType(type)
    setIsVerifyingLink(true)
    
    const nodeLogs = type === "github" ? [
      "[GATEWAY] Initiating GitHub secure connection...",
      "[OAUTH] Requesting OAuth key exchange token...",
      "[RESOLVE] Fetching metadata for node user 'alex_rivera_edge'...",
      "[VERIFY] Loading verification certificates on peer chain...",
      "[SUCCESS] Git signature registered. Node verification complete.",
    ] : [
      "[RPC] Querying browser Web3 provider extension...",
      "[CHAIN] Signature Request hash: 0x9f81a7b... Signing.",
      "[CRYPTO] Decrypting signature with public verification key...",
      "[LEDGER] Writing wallet authentication record to local block...",
      "[SUCCESS] Web3 signature matched. Identity verified.",
    ]

    setVerifyLogs([nodeLogs[0]])
    
    nodeLogs.slice(1).forEach((log, index) => {
      setTimeout(() => {
        setVerifyLogs((prev) => [...prev, log])
        if (index === nodeLogs.length - 2) {
          setIsVerifyingLink(false)
        }
      }, (index + 1) * 600)
    })
  }

  const handleCompleteVerify = () => {
    const field = verifyModalType === "github" ? "githubVerified" : "walletVerified"
    const updated = {
      ...profile,
      [field]: true
    }
    saveProfileData(updated)
    addToast(
      verifyModalType === "github" ? "GitHub Connected" : "Wallet Secured",
      verifyModalType === "github" ? "GitHub identity linked successfully." : "Web3 cryptographic signature verified.",
      "success"
    )
    setVerifyModalType(null)
  }

  // Interactive Completion checklist redirect click
  const handleChecklistClick = (task: string) => {
    if (task.includes("biography")) {
      openEditModal("about")
    } else if (task.includes("experience")) {
      handleOpenExpModal(null)
    } else if (task.includes("academic")) {
      handleOpenEduModal(null)
    } else if (task.includes("GitHub")) {
      if (!profile.githubVerified) handleStartSimulatedVerify("github")
    } else if (task.includes("Web3")) {
      if (!profile.walletVerified) handleStartSimulatedVerify("wallet")
    }
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12 relative">
      
      {/* Toast Alert container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 w-[330px] rounded-xl bg-background/85 border border-border/10 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300 relative overflow-hidden"
          >
            <div className="absolute bottom-0 left-0 h-[2px] w-full animate-out fade-out fill-mode-forwards origin-left bg-indigo-500" 
                 style={{ animationDuration: "4.5s", animationName: "shrinkProgress", backgroundColor: activeAccent.color }} />
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
              aria-label="Close Toast"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-serif font-light text-foreground leading-tight">Founder Profile</h2>
          <p className="text-foreground/40 text-xs font-sans font-light leading-relaxed">Construct your verification track record, education milestones, and wallet certificates.</p>
        </div>
      </div>

      <div className="grid gap-10 md:gap-12 md:grid-cols-3 items-start">
        
        {/* Profile left blocks (2 cols) */}
        <div className="space-y-10 md:col-span-2">
          
          {/* 1. Header Profile details Cardless */}
          <div className="py-6 border-b border-border/5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                {/* Glowing Avatar representation */}
                <div className="size-20 rounded-full overflow-hidden border-2 border-border/10 shrink-0 bg-foreground/5 flex items-center justify-center relative shadow-[0_4px_12px_rgba(0,0,0,0.3)] group">
                  {profile.avatarUrl ? (
                    profile.avatarUrl.startsWith("linear-gradient") ? (
                      <div className="size-full animate-pulse" style={{ background: profile.avatarUrl }} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="Avatar" className="size-full object-cover" />
                    )
                  ) : (
                    <span className="text-2xl font-bold font-mono text-foreground/60">{getInitials(profile.name)}</span>
                  )}
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    aria-label="Upload custom image"
                  >
                    <Camera className="h-5 w-5 text-foreground" />
                  </button>
                </div>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h1 className="text-2xl font-serif font-light text-foreground leading-tight">
                      {profile.name}
                    </h1>
                    {profile.isVerified && (
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border">
                        Verified Cohort Member
                      </Badge>
                    )}
                  </div>
                  <p className="text-foreground/80 text-sm font-sans">{profile.headline}</p>
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-foreground/45 font-mono pt-0.5">
                    <MapPin className="h-3.5 w-3.5" style={{ color: activeAccent.color }} />
                    <span>{profile.location}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="border border-border/5 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full h-8 w-8 shrink-0 cursor-pointer"
                aria-label="Edit Profile Header"
                onClick={() => openEditModal("header")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Social items and status footer */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-foreground/40 font-sans">
                <CheckCircle className="h-4 w-4" style={{ color: activeAccent.color }} />
                <span>Available for match connections & escrow pooling</span>
              </div>
              <div className="flex items-center gap-1">
                {profile.socials.linkedin && (
                  <a href={profile.socials.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn Profile">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full">
                      <Linkedin className="h-4 w-4" />
                    </Button>
                  </a>
                )}
                {profile.socials.twitter && (
                  <a href={profile.socials.twitter} target="_blank" rel="noreferrer" aria-label="Twitter Profile">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full">
                      <Twitter className="h-4 w-4" />
                    </Button>
                  </a>
                )}
                {profile.socials.website && (
                  <a href={profile.socials.website} target="_blank" rel="noreferrer" aria-label="Personal Website">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full">
                      <Globe className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 2. Biography Synopsis */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/5 pb-3">
              <h3 className="text-[11px] font-semibold tracking-widest uppercase text-foreground/45 font-mono">Biography Synopsis</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-full cursor-pointer"
                aria-label="Edit Bio"
                onClick={() => openEditModal("about")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-foreground/60 text-sm leading-relaxed font-sans pt-1">
              {profile.about || "No biography info entered yet. Complete profile settings to connect with prospective investors."}
            </p>
          </div>

          {/* 3. Skill tags component manager */}
          <div className="space-y-4">
            <div className="border-b border-border/5 pb-3">
              <h3 className="text-[11px] font-semibold tracking-widest uppercase text-foreground/45 font-mono">Expertise Tags</h3>
              <p className="text-foreground/35 text-[11px] font-mono uppercase tracking-wider pt-1">Type core expertise tag below and press Enter or comma to append</p>
            </div>
            <div className="space-y-4 pt-1">
              {/* Flex Tags list */}
              <div className="flex flex-wrap gap-2">
                {(profile.skills || []).map((skill) => (
                  <Badge
                    key={skill}
                    className="bg-foreground/[0.02] text-foreground/75 border-border/5 hover:border-border/10 rounded px-2.5 py-1 text-xs font-mono font-medium flex items-center gap-1.5 shadow-sm transition hover:bg-foreground/5"
                  >
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-foreground/30 hover:text-foreground cursor-pointer shrink-0 transition"
                      aria-label={`Remove Skill ${skill}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(profile.skills || []).length === 0 && (
                  <span className="text-xs text-foreground/30 font-mono">No expertise tags listed yet.</span>
                )}
              </div>

              {/* Skill Tag Input field */}
              <Input
                placeholder="Type expertise (e.g. Next.js, Rust) & press Enter..."
                value={newSkillText}
                onChange={(e) => setNewSkillText(e.target.value)}
                onKeyDown={handleAddSkill}
                className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
              />
            </div>
          </div>

          {/* 4. Experience Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/5 pb-3">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-foreground/45 font-mono">
                <Briefcase className="h-3.5 w-3.5" style={{ color: activeAccent.color }} /> Professional Track Record
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenExpModal(null)}
                className="h-8 rounded-lg text-[11px] font-mono uppercase tracking-wider text-foreground hover:bg-foreground/5 border-border/10 bg-transparent cursor-pointer flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Role
              </Button>
            </div>
            <div className="space-y-10 relative pt-2">
              {(profile.experience || []).length > 0 ? (
                <>
                  {/* Visual timeline connector line */}
                  <div className="absolute left-[11px] top-4 bottom-4 w-[1px] bg-foreground/5 pointer-events-none" />

                  {(profile.experience || []).map((exp, index) => (
                    <div key={index} className="flex gap-6 relative group/item">
                      <div className="size-6 rounded-full bg-background border border-border/15 text-foreground/60 grid place-items-center z-10 text-[11px] shrink-0 mt-1 font-mono font-semibold">
                        {index + 1}
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <h3 className="font-semibold text-sm text-foreground font-sans leading-tight">{exp.role}</h3>
                            <p className="text-xs text-brand-accent font-medium leading-none font-sans" style={{ color: activeAccent.color }}>{exp.company}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-foreground/35 font-mono bg-foreground/[0.02] border border-border/5 rounded px-2 py-0.5">{exp.duration}</span>
                            
                            {/* Action Tools */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenExpModal(index)}
                              className="h-6 w-6 text-foreground/30 hover:text-foreground hover:bg-foreground/5 rounded"
                              aria-label={`Edit role at ${exp.company}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteExperience(index)}
                              className="h-6 w-6 text-red-500/50 hover:text-red-400 hover:bg-red-500/5 rounded"
                              aria-label={`Delete role at ${exp.company}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground/60 leading-relaxed font-sans">{exp.description}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-6 text-xs text-foreground/30 font-mono">
                  No professional history listed. Complete credentials to index your profile.
                </div>
              )}
            </div>
          </div>

          {/* 5. Education Academics */}
          {/* 5. Education Academics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/5 pb-3">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-foreground/45 font-mono">
                <GraduationCap className="h-3.5 w-3.5" style={{ color: activeAccent.color }} /> Academic Background
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEduModal(null)}
                className="h-8 rounded-lg text-[11px] font-mono uppercase tracking-wider text-foreground hover:bg-foreground/5 border-border/10 bg-transparent cursor-pointer flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Academic
              </Button>
            </div>
            <div className="space-y-4 pt-2">
              {(profile.education || []).length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(profile.education || []).map((edu, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 py-3 border-b border-border/[0.03] transition duration-300"
                    >
                      <div className="size-8 rounded-lg bg-foreground/5 border border-border/5 text-foreground/50 grid place-items-center shrink-0 shadow">
                        <GraduationCap className="h-3.5 w-3.5" style={{ color: activeAccent.color }} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-semibold text-xs text-foreground font-sans truncate">{edu.institution}</h3>
                          
                          {/* Action tools */}
                          <div className="flex gap-0.5 shrink-0 opacity-40 hover:opacity-100 transition">
                            <button
                              onClick={() => handleOpenEduModal(index)}
                              className="text-foreground/40 hover:text-foreground"
                              aria-label={`Edit education at ${edu.institution}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteEducation(index)}
                              className="text-red-400/60 hover:text-red-400 ml-1"
                              aria-label={`Delete education at ${edu.institution}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-foreground/65 font-sans truncate">{edu.degree}</p>
                        <p className="text-[11px] text-foreground/30 font-mono leading-none">{edu.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-foreground/30 font-mono">
                  No academic credentials verified.
                </div>
              )}
            </div>
          </div>

          {/* 6. Fields of Interest */}
          {/* 6. Fields of Interest */}
          <div className="space-y-4">
            <div className="border-b border-border/5 pb-3">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-foreground/45 font-mono">
                <Compass className="h-3.5 w-3.5" style={{ color: activeAccent.color }} /> Core Interests & Fields
              </h3>
              <p className="text-foreground/35 text-[11px] font-mono uppercase tracking-wider pt-1">Type fields of interest below and press Enter or comma to append</p>
            </div>
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap gap-2">
                {(profile.interests || []).map((interest) => (
                  <Badge
                    key={interest}
                    className="bg-foreground/[0.02] text-foreground/60 border-border/5 hover:border-border/10 rounded px-2.5 py-0.5 text-xs font-mono flex items-center gap-1 shadow-sm transition hover:bg-foreground/5"
                  >
                    #{interest}
                    <button
                      onClick={() => handleRemoveInterest(interest)}
                      className="text-foreground/20 hover:text-foreground cursor-pointer shrink-0 transition ml-0.5"
                      aria-label={`Remove interest ${interest}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                {(profile.interests || []).length === 0 && (
                  <span className="text-xs text-foreground/30 font-mono">No interests linked.</span>
                )}
              </div>

              <Input
                placeholder="Type interest (e.g. P2P, AI, BioTech) & press Enter..."
                value={newInterestText}
                onChange={(e) => setNewInterestText(e.target.value)}
                onKeyDown={handleAddInterest}
                className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
              />
            </div>
          </div>

        </div>

        {/* Sidebar right blocks (1 col) */}
        <div className="space-y-6 md:col-span-1 md:sticky md:top-6">
          
          {/* Profile Completion Panel */}
          <div className="space-y-4">
            <div className="border-b border-border/5 pb-3">
              <h3 className="text-[11px] font-semibold tracking-widest uppercase text-foreground/45 font-mono">Completeness Score</h3>
              <p className="text-foreground/40 text-[11px] pt-1 leading-relaxed">
                Connect missing nodes and complete data blocks to verify developer index status.
              </p>
            </div>
            <div className="space-y-5 pt-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold font-mono">
                  <span className="text-foreground/40 uppercase tracking-wider">Scoring Index</span>
                  <span className="text-foreground" style={{ color: activeAccent.color }}>{profile.profileCompletion}%</span>
                </div>
                <Progress value={profile.profileCompletion} className="h-2 bg-foreground/5" indicatorClassName={activeAccent.bg} />
              </div>

              {/* Completion checklist tasks */}
              <div className="space-y-2 border-t border-border/5 pt-4">
                <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/35">Quick checklist</span>
                <div className="space-y-1">
                  {[
                    { text: "Add biography description", done: !!(profile.about && profile.about.trim().length > 10) },
                    { text: "Add at least 1 work experience", done: profile.experience.length > 0 },
                    { text: "Add academic credentials", done: profile.education.length > 0 },
                    { text: "Link GitHub node verification", done: !!profile.githubVerified },
                    { text: "Connect Web3 wallet signature", done: !!profile.walletVerified }
                  ].map((task, i) => (
                    <button
                      key={i}
                      disabled={task.done}
                      onClick={() => handleChecklistClick(task.text)}
                      className={cn(
                        "w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg text-[10.5px] font-sans border transition-all relative cursor-pointer",
                        task.done
                          ? "bg-emerald-500/5 border-emerald-600/15 text-emerald-700/75 dark:bg-emerald-500/[0.02] dark:border-emerald-500/10 dark:text-emerald-400/50 line-through cursor-not-allowed"
                          : "bg-transparent border-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      <span className="truncate pr-2">{task.text}</span>
                      {task.done ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 opacity-35 shrink-0 group-hover:translate-x-0.5 transition" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Verification connections panel */}
          <div className="space-y-4">
            <div className="border-b border-border/5 pb-3">
              <h3 className="text-[11px] font-semibold tracking-widest uppercase text-foreground/45 font-mono">Verification Nodes</h3>
              <p className="text-foreground/40 text-[11px] pt-1">Verify third-party authentication certificates</p>
            </div>
            <div className="space-y-3.5 pt-1">
              
              {/* GitHub Link State */}
              <div className="flex items-center justify-between py-3 border-b border-border/[0.03]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Github className="h-4 w-4 text-foreground/60 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground">GitHub Identity</span>
                    <span className="block text-[11px] font-mono text-foreground/30 uppercase tracking-wide leading-none pt-0.5">
                      {profile.githubVerified ? "Linked: @alex_edge" : "Unverified"}
                    </span>
                  </div>
                </div>

                {profile.githubVerified ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-mono py-0 px-2 rounded-full uppercase">Verified</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleStartSimulatedVerify("github")}
                    className={cn("h-7 rounded-lg text-[11px] font-mono uppercase tracking-wider py-0 px-2.5 cursor-pointer transition active:scale-95", activeAccent.btnBg)}
                  >
                    Connect
                  </Button>
                )}
              </div>

              {/* Web3 Wallet State */}
              <div className="flex items-center justify-between py-3 border-b border-border/[0.03]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Wallet className="h-4 w-4 text-foreground/60 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground">Web3 signature</span>
                    <span className="block text-[11px] font-mono text-foreground/30 uppercase tracking-wide leading-none pt-0.5">
                      {profile.walletVerified ? "Linked: ed25519" : "Unverified"}
                    </span>
                  </div>
                </div>

                {profile.walletVerified ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-mono py-0 px-2 rounded-full uppercase">Secured</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleStartSimulatedVerify("wallet")}
                    className={cn("h-7 rounded-lg text-[11px] font-mono uppercase tracking-wider py-0 px-2.5 cursor-pointer transition active:scale-95", activeAccent.btnBg)}
                  >
                    Verify
                  </Button>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* DIALOG 1: Header details edit */}
      <Dialog open={editMode === "header"} onOpenChange={() => !saving && setEditMode(null)}>
        <DialogContent className="bg-popover/95 border border-border/[0.08] backdrop-blur-2xl text-foreground rounded-2xl max-w-md shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-serif font-light text-foreground">Edit Profile Header</DialogTitle>
            <DialogDescription className="text-foreground/40 text-xs">Update your primary identity metrics visible on investor cohort indexes.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-3.5">
            <div className="space-y-1.5">
              <label htmlFor="p-name" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Display Name</label>
              <Input
                id="p-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={cn("bg-background/40 border-border/5 text-foreground text-xs rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="p-headline" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Headline Role</label>
              <Input
                id="p-headline"
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
                className={cn("bg-background/40 border-border/5 text-foreground text-xs rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="p-location" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Location Node</label>
              <Input
                id="p-location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className={cn("bg-background/40 border-border/5 text-foreground text-xs rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                required
              />
            </div>

            <div className="border-t border-border/5 pt-3 space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/30 block">Social connection handles</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="p-linkedin" className="text-[11px] text-foreground/40 font-mono">LinkedIn Url</label>
                  <Input
                    id="p-linkedin"
                    type="url"
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    className={cn("bg-background/40 border-border/5 text-foreground text-xs rounded-lg h-8 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="p-twitter" className="text-[11px] text-foreground/40 font-mono">Twitter Url</label>
                  <Input
                    id="p-twitter"
                    type="url"
                    value={editTwitter}
                    onChange={(e) => setEditTwitter(e.target.value)}
                    className={cn("bg-background/40 border-border/5 text-foreground text-xs rounded-lg h-8 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="p-website" className="text-[11px] text-foreground/40 font-mono">Personal Website</label>
                <Input
                  id="p-website"
                  type="url"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  className={cn("bg-background/40 border-border/5 text-foreground text-xs rounded-lg h-8 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditMode(null)}
                className="border-border/10 text-foreground hover:bg-foreground/5 text-xs font-semibold rounded-lg h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className={cn("text-xs font-semibold h-9 px-5 rounded-lg flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer", activeAccent.btnBg)}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Details
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Biography editor modal */}
      <Dialog open={editMode === "about"} onOpenChange={() => !saving && setEditMode(null)}>
        <DialogContent className="bg-popover/95 border border-border/[0.08] backdrop-blur-2xl text-foreground rounded-2xl max-w-md shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-serif font-light text-foreground">Edit Biography Synopsis</DialogTitle>
            <DialogDescription className="text-foreground/40 text-xs">Formulate a description detailing credentials, engineering focus, or project targets.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-3.5">
            <div className="space-y-1.5">
              <label htmlFor="p-bio" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Biography description</label>
              <Textarea
                id="p-bio"
                value={editAbout}
                onChange={(e) => setEditAbout(e.target.value)}
                className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg min-h-[140px] focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                required
              />
            </div>

            <DialogFooter className="pt-3 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditMode(null)}
                className="border-border/10 text-foreground hover:bg-foreground/5 text-xs font-semibold rounded-lg h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className={cn("text-xs font-semibold h-9 px-5 rounded-lg flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer", activeAccent.btnBg)}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Biography
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Add/Edit Experience Modal */}
      <Dialog open={expModalOpen} onOpenChange={setExpModalOpen}>
        <DialogContent className="bg-popover/95 border border-border/[0.08] backdrop-blur-2xl text-foreground rounded-2xl max-w-md shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-serif font-light text-foreground">
              {editingExpIndex !== null ? "Edit Professional Experience" : "Add Professional Experience"}
            </DialogTitle>
            <DialogDescription className="text-foreground/40 text-xs">Append a role timeline item detailing development history or milestones achieved.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveExperience} className="space-y-4 pt-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="exp-role" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Job Title / Role</label>
                <Input
                  id="exp-role"
                  value={expRole}
                  onChange={(e) => setExpRole(e.target.value)}
                  placeholder="e.g. Lead Architect"
                  className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="exp-company" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Company / Node</label>
                <Input
                  id="exp-company"
                  value={expCompany}
                  onChange={(e) => setExpCompany(e.target.value)}
                  placeholder="e.g. Edge Vision Kit"
                  className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="exp-duration" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Duration Timeline</label>
              <Input
                id="exp-duration"
                value={expDuration}
                onChange={(e) => setExpDuration(e.target.value)}
                placeholder="e.g. 2025 - Present"
                className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="exp-desc" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Role Description & Milestones</label>
              <Textarea
                id="exp-desc"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Detail technical actions, sync nodes established, smart contract rulesets deployed..."
                className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg min-h-[90px] focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                required
              />
            </div>

            <DialogFooter className="pt-3 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpModalOpen(false)}
                className="border-border/10 text-foreground hover:bg-foreground/5 text-xs font-semibold rounded-lg h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={cn("text-xs font-semibold h-9 px-5 rounded-lg flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer", activeAccent.btnBg)}
              >
                <Save className="h-3.5 w-3.5" />
                {editingExpIndex !== null ? "Save Role" : "Add Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Add/Edit Education Modal */}
      <Dialog open={eduModalOpen} onOpenChange={setEduModalOpen}>
        <DialogContent className="bg-popover/95 border border-border/[0.08] backdrop-blur-2xl text-foreground rounded-2xl max-w-md shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-serif font-light text-foreground">
              {editingEduIndex !== null ? "Edit Academic Record" : "Add Academic Record"}
            </DialogTitle>
            <DialogDescription className="text-foreground/40 text-xs">Append educational background or verified credentials to index database.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEducation} className="space-y-4 pt-3.5">
            <div className="space-y-1.5">
              <label htmlFor="edu-inst" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Institution name</label>
              <Input
                id="edu-inst"
                value={eduInstitution}
                onChange={(e) => setEduInstitution(e.target.value)}
                placeholder="e.g. UC Berkeley"
                className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="edu-degree" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Degree Earned</label>
                <Input
                  id="edu-degree"
                  value={eduDegree}
                  onChange={(e) => setEduDegree(e.target.value)}
                  placeholder="e.g. B.S. in Computer Science"
                  className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edu-duration" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono">Timeline Years</label>
                <Input
                  id="edu-duration"
                  value={eduDuration}
                  onChange={(e) => setEduDuration(e.target.value)}
                  placeholder="e.g. 2018 - 2022"
                  className={cn("bg-background/40 border-border/5 text-xs text-foreground rounded-lg h-9 focus-visible:ring-offset-0 focus-visible:ring-1", activeAccent.ring)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-3 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEduModalOpen(false)}
                className="border-border/10 text-foreground hover:bg-foreground/5 text-xs font-semibold rounded-lg h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={cn("text-xs font-semibold h-9 px-5 rounded-lg flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer", activeAccent.btnBg)}
              >
                <Save className="h-3.5 w-3.5" />
                {editingEduIndex !== null ? "Save Academics" : "Add Academics"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: Simulated Connection logs Modal */}
      <Dialog open={verifyModalType !== null} onOpenChange={(open) => !isVerifyingLink && setVerifyModalType(open ? verifyModalType : null)}>
        <DialogContent className="bg-popover/95 border border-border/[0.08] backdrop-blur-2xl text-foreground rounded-2xl max-w-md shadow-2xl p-6 font-sans">
          <DialogHeader className="border-b border-border/5 pb-3">
            <DialogTitle className="text-base font-serif font-light text-foreground flex items-center gap-2">
              {verifyModalType === "github" ? <Github className="h-4.5 w-4.5" /> : <Wallet className="h-4.5 w-4.5" />}
              {verifyModalType === "github" ? "GitHub Verification Node" : "Web3 Wallet Signature Verification"}
            </DialogTitle>
            <DialogDescription className="text-foreground/40 text-xs">
              Establish decentralized credentials to increase your credibility index ranking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {isVerifyingLink ? (
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-foreground/50 uppercase tracking-widest flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" style={{ color: activeAccent.color }} />
                  Broadcasting verification handshake...
                </span>
                <div className="bg-black p-4 border border-border/5 rounded-lg font-mono text-[11px] text-foreground/60 h-32 overflow-y-auto space-y-1">
                  {verifyLogs.map((log, i) => (
                    <div key={i} className={cn(log.includes("SUCCESS") ? "text-emerald-400" : log.includes("GATEWAY") || log.includes("RPC") ? "text-blue-400" : "text-foreground/50")}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-center py-2.5">
                <div className="mx-auto size-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 grid place-items-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">Authentication Verified</h4>
                  <p className="text-[11px] text-foreground/50 max-w-xs mx-auto">
                    {verifyModalType === "github" 
                      ? "OAuth signature link verified. Public user metadata securely tied to profile node."
                      : "Multi-sig signature cryptographic challenge verified. Wallet link linked."}
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="pt-3">
              {isVerifyingLink ? (
                <Button disabled className="w-full text-xs font-semibold h-9 rounded-lg font-mono bg-foreground/5 text-foreground/30 border border-border/5">
                  Verifying Credentials...
                </Button>
              ) : (
                <Button
                  onClick={handleCompleteVerify}
                  className={cn("w-full text-xs font-semibold h-9 rounded-lg font-mono active:scale-[0.98] transition cursor-pointer", activeAccent.btnBg)}
                >
                  Verify & Sync Profile
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// Initials resolver helper
const getInitials = (n: string) => {
  if (!n) return "A"
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
