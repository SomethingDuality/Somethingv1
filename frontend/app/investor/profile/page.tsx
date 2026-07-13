"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Building2,
  Link2,
  ShieldCheck,
  Tag,
  UserRound,
  Wallet,
  Loader2,
  SlidersHorizontal,
  Plus,
  Trash2,
  Users2,
  Briefcase,
  Globe2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Shared components
import { VerificationBadge } from "@/components/verification-badge"
import { TrustInspector } from "@/components/trust-inspector"
import { AvatarUploader } from "@/components/avatar-uploader"
import { useAvatar } from "@/components/avatar-context"

const PRESET_INTERESTS = ["Climate hardware", "Edge AI", "Local‑first", "Robotics", "Bio tooling", "Privacy", "DePIN"]

const ALL_STAGES = [
  "Pre‑seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Growth",
  "Venture Debt",
  "Angel",
  "Grants",
  "Non‑dilutive"
]

const PRESET_STRUCTURES = [
  "US Delaware C-Corp",
  "Singapore PTE LTD",
  "Cayman Foundation",
  "UK Limited",
  "German GmbH",
  "Estonian Entity"
]

const ALL_SUPERPOWERS = [
  "Technical Recruitment",
  "Enterprise Sales Intros",
  "SEC/Regulatory Guidance",
  "Dev Rel & Growth",
  "PR & Communications",
  "Follow-on Syndication"
]

type TechnicalPreferenceValue = "yes" | "maybe" | "no"
type LeadStatus = "lead" | "follow" | "both"

type InvestorNote = {
  id: string
  content: string
  createdAt: string
}

type InvestorProfile = {
  name: string
  firm: string
  minCheck: number
  maxCheck: number
  bio: string
  interests: string[]
  
  // Three-state preference fields
  escrowPreference?: TechnicalPreferenceValue
  ndaPreference?: TechnicalPreferenceValue
  openSourcePreference?: TechnicalPreferenceValue
  hardwarePreference?: TechnicalPreferenceValue
  cryptographyPreference?: TechnicalPreferenceValue
  
  // Old fields for compatibility
  escrowRequired?: boolean
  ndaPreferred?: boolean

  pacePerQuarter: number
  stageFocus: string[]
  publicProfile: boolean
  handle: string
  trust: number
  trustBreakdown: {
    ndas: number
    escrowReleases: number
    receipts: number
    history: number
  }
  links: Array<{ label: string; href: string }>
  portfolio: Array<{ id: string; name: string }>
  
  // Custom manual match tags and criteria
  customMatchKeywords?: string[]
  matchingNotes?: string // Legacy fallback
  notes?: InvestorNote[]

  // Extended Matchmaking & Syndicate Details
  leadStatus?: LeadStatus
  legalStructures?: string[]
  vehicles?: ("Direct Fund" | "SPV" | "Syndicate" | "Venture Debt")[]
  superpowers?: string[]
  coInvestors?: string[]
  totalCapitalPool?: number
}

const DEFAULT_PROFILE: InvestorProfile = {
  name: "",
  firm: "",
  minCheck: 5000,
  maxCheck: 50000,
  bio: "",
  interests: [],
  escrowPreference: "yes",
  ndaPreference: "yes",
  openSourcePreference: "maybe",
  hardwarePreference: "maybe",
  cryptographyPreference: "yes",
  pacePerQuarter: 1,
  stageFocus: [],
  publicProfile: true,
  handle: "",
  trust: 0,
  trustBreakdown: {
    ndas: 0,
    escrowReleases: 0,
    receipts: 0,
    history: 0
  },
  links: [],
  portfolio: [],
  customMatchKeywords: [],
  notes: [],
  leadStatus: "both",
  legalStructures: [],
  vehicles: [],
  superpowers: [],
  coInvestors: [],
  totalCapitalPool: 0
}

export default function InvestorProfilePage() {
  const { avatarUrl, setAvatarUrl, userName, setUserName } = useAvatar()
  
  // Profile state
  const [profile, setProfile] = useState<InvestorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Individual field states (synced with profile)
  const [name, setName] = useState("")
  const [firm, setFirm] = useState("")
  const [minCheck, setMinCheck] = useState(5000)
  const [maxCheck, setMaxCheck] = useState(50000)
  const [bio, setBio] = useState("")
  const [interests, setInterests] = useState<string[]>([])
  
  // Three-state preference fields
  const [escrowPreference, setEscrowPreference] = useState<TechnicalPreferenceValue>("yes")
  const [ndaPreference, setNdaPreference] = useState<TechnicalPreferenceValue>("yes")
  const [openSourcePreference, setOpenSourcePreference] = useState<TechnicalPreferenceValue>("maybe")
  const [hardwarePreference, setHardwarePreference] = useState<TechnicalPreferenceValue>("maybe")
  const [cryptographyPreference, setCryptographyPreference] = useState<TechnicalPreferenceValue>("maybe")
  
  const [pacePerQuarter, setPacePerQuarter] = useState(4)
  const [stageFocus, setStageFocus] = useState<string[]>([])
  const [publicProfile, setPublicProfile] = useState(true)
  const [handle, setHandle] = useState("")

  // Custom keywords & notes list
  const [customMatchKeywords, setCustomMatchKeywords] = useState<string[]>([])
  const [notes, setNotes] = useState<InvestorNote[]>([])
  const [newNoteText, setNewNoteText] = useState("")
  
  // Extended Matchmaking Fields
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("both")
  const [legalStructures, setLegalStructures] = useState<string[]>([])
  const [vehicles, setVehicles] = useState<("Direct Fund" | "SPV" | "Syndicate" | "Venture Debt")[]>([])
  const [superpowers, setSuperpowers] = useState<string[]>([])
  const [coInvestors, setCoInvestors] = useState<string[]>([])
  const [totalCapitalPool, setTotalCapitalPool] = useState(1000000)

  // Input fields for adding custom tags
  const [newSectorInput, setNewSectorInput] = useState("")
  const [newKeywordInput, setNewKeywordInput] = useState("")
  const [newStructureInput, setNewStructureInput] = useState("")
  const [newCoInvestorInput, setNewCoInvestorInput] = useState("")

  const [accreditedVerified, setAccreditedVerified] = useState(false)
  const [isVerificationOpen, setIsVerificationOpen] = useState(false)
  const [verifyCriteria, setVerifyCriteria] = useState("networth")

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAccreditedVerified(localStorage.getItem("investor_accredited_verified") === "true")
    }
  }, [])

  const handleVerifyAccreditation = () => {
    localStorage.setItem("investor_accredited_verified", "true")
    setAccreditedVerified(true)
    setIsVerificationOpen(false)
    alert("SEC Rule 506(c) Accreditation Certified successfully.")
  }

  const [portfolioList, setPortfolioList] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    const localPortfolio = localStorage.getItem("investor_portfolio")
    if (localPortfolio) {
      try {
        const parsed = JSON.parse(localPortfolio)
        setPortfolioList(parsed.map((item: any) => ({ id: item.id, name: item.name })))
      } catch {
        setPortfolioList([])
      }
    } else if (profile) {
      setPortfolioList(profile.portfolio)
    }
  }, [profile])

  // Sync local state with profile
  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setUserName(profile.name)
      setFirm(profile.firm)
      setMinCheck(profile.minCheck)
      setMaxCheck(profile.maxCheck)
      setBio(profile.bio)
      setInterests(profile.interests || [])

      // Backward compatibility logic for old boolean preferences
      if (profile.escrowPreference) {
        setEscrowPreference(profile.escrowPreference)
      } else if (typeof profile.escrowRequired !== "undefined") {
        setEscrowPreference(profile.escrowRequired ? "yes" : "no")
      } else {
        setEscrowPreference("yes")
      }

      if (profile.ndaPreference) {
        setNdaPreference(profile.ndaPreference)
      } else if (typeof profile.ndaPreferred !== "undefined") {
        setNdaPreference(profile.ndaPreferred ? "yes" : "no")
      } else {
        setNdaPreference("yes")
      }

      setOpenSourcePreference(profile.openSourcePreference || "maybe")
      setHardwarePreference(profile.hardwarePreference || "maybe")
      setCryptographyPreference(profile.cryptographyPreference || "maybe")

      setPacePerQuarter(profile.pacePerQuarter)
      setStageFocus(profile.stageFocus || [])
      setPublicProfile(profile.publicProfile)
      setHandle(profile.handle)
      setCustomMatchKeywords(profile.customMatchKeywords || [])
      
      // Fallback from old matchingNotes string to array list
      if (profile.notes && Array.isArray(profile.notes)) {
        setNotes(profile.notes)
      } else if (profile.matchingNotes) {
        setNotes([
          {
            id: "legacy-note",
            content: profile.matchingNotes,
            createdAt: new Date().toLocaleDateString()
          }
        ])
      } else {
        setNotes([])
      }

      // Sync Extended parameters
      setLeadStatus(profile.leadStatus || "both")
      setLegalStructures(profile.legalStructures || [])
      setVehicles(profile.vehicles || ["Direct Fund"])
      setSuperpowers(profile.superpowers || [])
      setCoInvestors(profile.coInvestors || [])
      setTotalCapitalPool(profile.totalCapitalPool || 1000000)
    }
  }, [profile, setUserName])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get<InvestorProfile>("/investor/profile")
      setProfile(response.data)
    } catch (err) {
      console.warn("Failed to fetch API investor profile, using localStorage fallback:", err)
      const stored = localStorage.getItem("investor_profile_data")
      if (stored) {
        try {
          setProfile(JSON.parse(stored))
        } catch {
          setProfile(DEFAULT_PROFILE)
          localStorage.setItem("investor_profile_data", JSON.stringify(DEFAULT_PROFILE))
        }
      } else {
        const demoName = localStorage.getItem("demo_name")
        const initialProfile = demoName ? { ...DEFAULT_PROFILE, name: demoName } : DEFAULT_PROFILE
        setProfile(initialProfile)
        localStorage.setItem("investor_profile_data", JSON.stringify(initialProfile))
      }
    } finally {
      setLoading(false)
    }
  }

  const saveProfileDataLocally = (updated: InvestorProfile) => {
    setProfile(updated)
    localStorage.setItem("investor_profile_data", JSON.stringify(updated))
    localStorage.setItem("demo_name", updated.name)
    window.dispatchEvent(new CustomEvent("investor-profile-update"))
  }

  const saveProfile = async () => {
    try {
      setSaving(true)
      setError(null)
      const payload = { name, firm, minCheck, maxCheck, bio, totalCapitalPool }
      await apiClient.put("/investor/profile", payload)
      await fetchProfile()
    } catch (err) {
      console.warn("Failed API save, updating locally:", err)
      if (profile) {
        const updated: InvestorProfile = {
          ...profile,
          name,
          firm,
          minCheck,
          maxCheck,
          bio,
          interests,
          escrowPreference,
          ndaPreference,
          openSourcePreference,
          hardwarePreference,
          cryptographyPreference,
          stageFocus,
          customMatchKeywords,
          notes,
          leadStatus,
          legalStructures,
          vehicles,
          superpowers,
          coInvestors,
          totalCapitalPool
        }
        saveProfileDataLocally(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const savePreferences = async () => {
    try {
      setSaving(true)
      setError(null)
      const payload = {
        escrowPreference,
        ndaPreference,
        openSourcePreference,
        hardwarePreference,
        cryptographyPreference,
        pacePerQuarter,
        stageFocus,
        customMatchKeywords,
        notes,
        leadStatus,
        legalStructures,
        vehicles,
        superpowers,
        coInvestors,
        totalCapitalPool
      }
      await apiClient.put("/investor/preferences", payload)
      await fetchProfile()
    } catch (err) {
      console.warn("Failed API save preferences, updating locally:", err)
      if (profile) {
        const updated: InvestorProfile = {
          ...profile,
          escrowPreference,
          ndaPreference,
          openSourcePreference,
          hardwarePreference,
          cryptographyPreference,
          pacePerQuarter,
          stageFocus,
          customMatchKeywords,
          notes,
          leadStatus,
          legalStructures,
          vehicles,
          superpowers,
          coInvestors,
          totalCapitalPool
        }
        saveProfileDataLocally(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const updateInterests = async (newInterests: string[]) => {
    try {
      await apiClient.put("/investor/interests", { interests: newInterests })
      setInterests(newInterests)
    } catch (err) {
      console.warn("Failed API update interests, updating locally:", err)
      setInterests(newInterests)
      if (profile) {
        const updated = { ...profile, interests: newInterests }
        saveProfileDataLocally(updated)
      }
    }
  }

  const updateVisibility = async (field: "publicProfile" | "handle", value: boolean | string) => {
    try {
      await apiClient.put("/investor/visibility", { [field]: value })
      if (field === "publicProfile") setPublicProfile(value as boolean)
      if (field === "handle") setHandle(value as string)
    } catch (err) {
      console.warn(`Failed API update visibility for ${field}, updating locally:`, err)
      if (field === "publicProfile") setPublicProfile(value as boolean)
      if (field === "handle") setHandle(value as string)
      if (profile) {
        const updated = { ...profile, [field]: value }
        saveProfileDataLocally(updated)
      }
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const response = await apiClient.post<{ url: string }>("/investor/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setAvatarUrl(response.data.url)
    } catch (err) {
      console.warn("Failed API upload avatar, generating URL locally:", err)
      const dummyUrl = URL.createObjectURL(file)
      setAvatarUrl(dummyUrl)
      if (profile) {
        const updated = { ...profile, avatarUrl: dummyUrl }
        saveProfileDataLocally(updated)
      }
    }
  }

  const requestReverification = async () => {
    try {
      await apiClient.post("/investor/reverify")
      alert("Re-verification request submitted")
    } catch (err) {
      console.warn("Failed API request verification, simulating locally:", err)
      alert("Re-verification request submitted (Sandbox Mode)")
    }
  }

  const toggleInterest = (tag: string) => {
    const newInterests = interests.includes(tag)
      ? interests.filter((t) => t !== tag)
      : [...interests, tag]
    updateInterests(newInterests)
  }

  const handleAddCustomSector = () => {
    const val = newSectorInput.trim()
    if (!val) return
    if (interests.includes(val)) {
      setNewSectorInput("")
      return
    }
    const newInterests = [...interests, val]
    updateInterests(newInterests)
    setNewSectorInput("")
  }

  const handleAddKeyword = () => {
    const val = newKeywordInput.trim()
    if (!val) return
    if (customMatchKeywords.includes(val)) {
      setNewKeywordInput("")
      return
    }
    setCustomMatchKeywords((prev) => [...prev, val])
    setNewKeywordInput("")
  }

  const handleAddLegalStructure = () => {
    const val = newStructureInput.trim()
    if (!val) return
    if (legalStructures.includes(val)) {
      setNewStructureInput("")
      return
    }
    setLegalStructures((prev) => [...prev, val])
    setNewStructureInput("")
  }

  const handleAddCoInvestor = () => {
    const val = newCoInvestorInput.trim()
    if (!val) return
    if (coInvestors.includes(val)) {
      setNewCoInvestorInput("")
      return
    }
    setCoInvestors((prev) => [...prev, val])
    setNewCoInvestorInput("")
  }

  const toggleStage = (s: string) => {
    setStageFocus((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const toggleSuperpower = (s: string) => {
    setSuperpowers((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const toggleVehicle = (v: "Direct Fund" | "SPV" | "Syndicate" | "Venture Debt") => {
    setVehicles((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  const handleAddNote = () => {
    const val = newNoteText.trim()
    if (!val) return
    
    const newNote: InvestorNote = {
      id: `note-${Date.now()}`,
      content: val,
      createdAt: new Date().toLocaleDateString()
    }
    const updatedNotes = [newNote, ...notes]
    setNotes(updatedNotes)
    setNewNoteText("")
    
    if (profile) {
      const updated = {
        ...profile,
        notes: updatedNotes
      }
      saveProfileDataLocally(updated)
    }
  }

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter((n) => n.id !== noteId)
    setNotes(updatedNotes)
    
    if (profile) {
      const updated = {
        ...profile,
        notes: updatedNotes
      }
      saveProfileDataLocally(updated)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12">
      {/* Header: Avatar • Info • Trust */}
      <section className="rounded-2xl bg-card/10 border border-border/15 backdrop-blur-xl p-8 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_360px] md:items-start lg:items-center">
          <div>
            <AvatarUploader
              name={userName}
              src={avatarUrl}
              onChange={(file, url) => {
                if (file) uploadAvatar(file)
                else setAvatarUrl(url)
              }}
              size={80}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">{userName}</h1>
              <VerificationBadge className="shrink-0" />
              {accreditedVerified && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25 font-mono text-[9.5px] py-0.5 px-2 rounded-full flex items-center gap-1 shrink-0">
                  <ShieldCheck className="h-3 w-3 animate-pulse" /> SEC 506(c) Verified
                </Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-2 text-foreground/70 text-sm font-mono">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{firm || "Horizon Ventures"}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 md:col-span-2 lg:col-span-1">
            <div className="flex-1 lg:flex-none">
              <TrustInspector
                trust={profile?.trust ?? 0}
                baseline={75}
                breakdown={profile?.trustBreakdown}
                className="w-full max-w-[220px]"
              />
            </div>
            <Button
              onClick={requestReverification}
              className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Request re‑verify
            </Button>
          </div>
        </div>
      </section>

      {/* Body: Main left • Right rail */}
      <div className="mt-10 sm:mt-12 grid gap-10 sm:gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Main column */}
        <div className="min-w-0 space-y-10 sm:space-y-12">
          {/* Essentials */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-serif font-light text-foreground">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                Profile Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-accent/30 border-border text-xs"
                />
              </Field>
              <Field label="Affiliation">
                <Input
                  value={firm}
                  onChange={(e) => setFirm(e.target.value)}
                  className="bg-accent/30 border-border text-xs"
                />
              </Field>

              <div className="grid gap-2 sm:col-span-2">
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-[10px]">Typical check size (USD)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">Min</span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={minCheck}
                      onChange={(e) => setMinCheck(safeInt(e.target.value, minCheck))}
                      className="h-9 bg-accent/30 border-border text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">Max</span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={maxCheck}
                      onChange={(e) => setMaxCheck(safeInt(e.target.value, maxCheck))}
                      className="h-9 bg-accent/30 border-border text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Field label="Total Capital Pool Allocation (USD)">
                  <Input
                    type="number"
                    min={0}
                    step={10000}
                    value={totalCapitalPool}
                    onChange={(e) => setTotalCapitalPool(safeInt(e.target.value, totalCapitalPool))}
                    className="h-9 bg-accent/30 border-border text-xs"
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Bio">
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="min-h-[100px] bg-accent/30 border-border text-xs leading-relaxed"
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Button
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-fit rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Investment Sector Focus (With Custom Tag Adder) */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-serif font-light text-foreground">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Investment Sector focus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* Active list of selected sectors (dismissible) */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Active Sectors</div>
                <div className="flex flex-wrap gap-2">
                  {interests.map((t) => (
                    <div
                      key={t}
                      className="text-xs rounded-md px-2.5 py-1.5 border flex items-center gap-1.5 border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground font-sans font-medium"
                    >
                      <span>{t}</span>
                      <button
                        onClick={() => toggleInterest(t)}
                        className="text-foreground/45 hover:text-foreground/80 font-bold ml-0.5 cursor-pointer bg-transparent border-0 p-0"
                        title={`Remove ${t}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {interests.length === 0 && (
                    <div className="text-xs text-muted-foreground italic py-1">No active sectors selected. Use suggestions or type custom sectors below.</div>
                  )}
                </div>
              </div>

              {/* Suggested Tags suggestions list */}
              <div className="space-y-1.5 pt-2 border-t border-border/10">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Suggested Sectors</div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_INTERESTS.filter((t) => !interests.includes(t)).map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleInterest(t)}
                      className="text-xs rounded-md px-3 py-1.5 border border-border/60 text-foreground/80 hover:bg-accent/40 transition cursor-pointer"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inline Custom Sector Adder */}
              <div className="flex items-center gap-2 max-w-sm pt-2 border-t border-border/10">
                <Input
                  placeholder="Add custom sector (e.g. Zero-Knowledge)..."
                  value={newSectorInput}
                  onChange={(e) => setNewSectorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddCustomSector()
                    }
                  }}
                  className="h-8 bg-accent/30 border-border text-xs flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleAddCustomSector}
                  className="h-8 text-xs rounded-lg px-3 bg-foreground text-background hover:bg-foreground/90 cursor-pointer shrink-0"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* New Card: Matchmaking & Syndicate Details */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-serif font-light text-foreground">
                <Users2 className="h-4.5 w-4.5 text-muted-foreground" />
                Matchmaking & Syndicate Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* 1. Lead Status Segmented Control */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border bg-accent/30 p-3.5 shadow-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground/90 uppercase tracking-wider">Lead Investor Status</div>
                  <div className="text-[11px] text-muted-foreground leading-normal mt-1">Specify whether you lead investment rounds or follow/participate.</div>
                </div>
                <div className="flex bg-accent/60 rounded-lg p-0.5 border border-border/40 w-fit shrink-0">
                  {([
                    { id: "lead", label: "Lead" },
                    { id: "follow", label: "Follow-only" },
                    { id: "both", label: "Flexible/Both" }
                  ] as const).map((opt) => {
                    const isActive = leadStatus === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLeadStatus(opt.id)}
                        className={cn(
                          "px-3 py-1 rounded-md text-[10px] font-mono uppercase font-bold tracking-wider transition-all border border-transparent cursor-pointer",
                          isActive
                            ? "bg-[var(--brand-accent)]/10 text-foreground border-[var(--brand-accent)]/35"
                            : "text-foreground/45 hover:text-foreground/80 hover:bg-foreground/5"
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. Allowed Legal Structures Tag List */}
              <div className="grid gap-2.5 pt-3 border-t border-border/10">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Allowed Legal Structures</div>
                
                <div className="flex flex-wrap gap-2 mb-1.5">
                  {legalStructures.map((s) => (
                    <div
                      key={s}
                      className="text-xs rounded-md px-2.5 py-1.5 border border-border bg-accent/20 text-foreground flex items-center gap-1.5 font-sans"
                    >
                      <span>{s}</span>
                      <button
                        onClick={() => setLegalStructures((prev) => prev.filter((x) => x !== s))}
                        className="text-foreground/45 hover:text-foreground/80 font-bold ml-0.5 cursor-pointer bg-transparent border-0 p-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {legalStructures.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">No legal structures specified. Add custom or suggested ones below.</div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_STRUCTURES.filter((s) => !legalStructures.includes(s)).map((s) => (
                    <button
                      key={s}
                      onClick={() => setLegalStructures((prev) => [...prev, s])}
                      className="text-[11px] rounded border border-border/60 text-foreground/75 px-2 py-1 hover:bg-accent/40 cursor-pointer"
                    >
                      + {s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    placeholder="Add custom structure (e.g. LLC)..."
                    value={newStructureInput}
                    onChange={(e) => setNewStructureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddLegalStructure()
                      }
                    }}
                    className="h-8 bg-accent/30 border-border text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddLegalStructure}
                    className="h-8 text-xs rounded-lg px-3 bg-foreground text-background hover:bg-foreground/90 cursor-pointer shrink-0"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>

              {/* 3. Allowed Investment Vehicles Checks */}
              <div className="grid gap-2.5 pt-4 border-t border-border/10">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Investment Vehicles Accepted</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["Direct Fund", "SPV", "Syndicate", "Venture Debt"] as const).map((v) => {
                    const isChecked = vehicles.includes(v)
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleVehicle(v)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 text-xs transition-all cursor-pointer text-left w-full",
                          isChecked
                            ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground"
                            : "border-border/60 text-foreground/60 hover:bg-accent/40"
                        )}
                      >
                        <span>{v}</span>
                        <div className={cn(
                          "size-4 rounded-full border flex items-center justify-center shrink-0 ml-2",
                          isChecked ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]" : "border-border/50 bg-transparent"
                        )}>
                          {isChecked && (
                            <svg className="size-2.5 text-background stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 4. Operational Support/Superpowers */}
              <div className="grid gap-2.5 pt-4 border-t border-border/10">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Operational Support & Superpowers (Value Add)</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_SUPERPOWERS.map((s) => {
                    const isChecked = superpowers.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSuperpower(s)}
                        className={cn(
                          "text-xs rounded-md px-3 py-1.5 border transition cursor-pointer font-sans font-medium",
                          isChecked
                            ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground"
                            : "border-border/60 text-foreground/80 hover:bg-accent/40"
                        )}
                      >
                        {isChecked ? `✓ ${s}` : `+ ${s}`}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 5. Co-Investment Networks tag adder */}
              <div className="grid gap-2.5 pt-4 border-t border-border/10">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Co-Investment Networks (Syndicates)</div>
                
                <div className="flex flex-wrap gap-2 mb-1.5">
                  {coInvestors.map((c) => (
                    <div
                      key={c}
                      className="text-xs rounded-full px-2.5 py-1 bg-accent/40 border border-border/60 flex items-center gap-1.5 text-foreground/90 font-mono"
                    >
                      <span>{c}</span>
                      <button
                        onClick={() => setCoInvestors((prev) => prev.filter((x) => x !== c))}
                        className="text-foreground/45 hover:text-foreground/75 font-bold ml-0.5 cursor-pointer bg-transparent border-0 p-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {coInvestors.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">No co-investors linked. Add regular syndicates below.</div>
                  )}
                </div>

                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    placeholder="Add fund or investor name..."
                    value={newCoInvestorInput}
                    onChange={(e) => setNewCoInvestorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddCoInvestor()
                      }
                    }}
                    className="h-8 bg-accent/30 border-border text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCoInvestor}
                    className="h-8 text-xs rounded-lg px-3 bg-foreground text-background hover:bg-foreground/90 cursor-pointer shrink-0"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-border/10">
                <Button
                  onClick={savePreferences}
                  disabled={saving}
                  className="w-fit rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save syndicate details
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preferences with Segmented 3-Way Toggles */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-serif font-light text-foreground">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Technical & Commitment Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* 3-State Toggle Group List */}
              <div className="space-y-3.5">
                <ThreeStateToggle
                  label="Milestone-based Escrow Releases"
                  desc="Preference for disbursements tied to verified cohort delivery milestones."
                  value={escrowPreference}
                  onChange={setEscrowPreference}
                />
                <ThreeStateToggle
                  label="Mutual NDA (mNDA)"
                  desc="Preference for signing mutual NDAs prior to reviewing code repositories."
                  value={ndaPreference}
                  onChange={setNdaPreference}
                />
                <ThreeStateToggle
                  label="Open Source Code Repositories"
                  desc="Preference for systems built fully or partially on open-source packages."
                  value={openSourcePreference}
                  onChange={setOpenSourcePreference}
                />
                <ThreeStateToggle
                  label="Hardware Component Audits"
                  desc="Preference for physical hardware design validation/supply-chain audits."
                  value={hardwarePreference}
                  onChange={setHardwarePreference}
                />
                <ThreeStateToggle
                  label="Cryptographic Trust Verification"
                  desc="Preference for on-chain/cryptographic signatures or zero-knowledge credentials."
                  value={cryptographyPreference}
                  onChange={setCryptographyPreference}
                />
              </div>

              {/* Stage Focus Grid (Expanded Stages) */}
              <div className="grid gap-2.5 pt-4 border-t border-border/10">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Investment Stage focus</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_STAGES.map((s) => {
                    const on = stageFocus.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStage(s)}
                        className={cn(
                          "text-xs rounded-md px-3 py-1.5 border transition cursor-pointer font-sans font-medium",
                          on
                            ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-foreground"
                            : "border-border/60 text-foreground/80 hover:bg-accent/40"
                        )}
                        aria-pressed={on}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pace Slider */}
              <div className="grid gap-2 pt-4 border-t border-border/10">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Pace (investments per quarter)</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={1}
                    value={pacePerQuarter}
                    onChange={(e) => setPacePerQuarter(Number.parseInt(e.target.value))}
                    className="w-full cursor-pointer accent-[var(--brand-accent)]"
                    aria-label="Pace per quarter"
                  />
                  <div className="w-10 text-right font-mono text-xs">{pacePerQuarter}</div>
                </div>
              </div>

              <Button
                onClick={savePreferences}
                disabled={saving}
                className="w-fit rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save preferences
              </Button>
            </CardContent>
          </Card>

          {/* Custom Matching Criteria & Notes (Freeform Manual Input) */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-serif font-light text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                Custom Matching Criteria & Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* Keyword tags */}
              <div className="grid gap-2">
                <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  Custom Matching Tags (e.g. SOC2, YC Alumni, Stanford)
                </label>
                <div className="flex flex-wrap gap-2 mb-1.5">
                  {customMatchKeywords.map((k) => (
                    <div
                      key={k}
                      className="text-xs rounded-full px-3 py-1 bg-accent/40 border border-border/60 flex items-center gap-1.5 text-foreground/90 font-mono"
                    >
                      <span>{k}</span>
                      <button
                        onClick={() => setCustomMatchKeywords((prev) => prev.filter((x) => x !== k))}
                        className="text-foreground/45 hover:text-foreground/75 font-bold cursor-pointer bg-transparent border-0 p-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {customMatchKeywords.length === 0 && (
                    <div className="text-xs text-muted-foreground italic font-sans py-1">No custom match tags added yet.</div>
                  )}
                </div>
                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    placeholder="Type custom tag (e.g. Rust)..."
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddKeyword()
                      }
                    }}
                    className="h-8 bg-accent/30 border-border text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddKeyword}
                    className="h-8 text-xs rounded-lg px-3 bg-foreground text-background hover:bg-foreground/90 cursor-pointer shrink-0"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>

              {/* Ledger/List of Notes */}
              <div className="grid gap-3 pt-3 border-t border-border/10">
                <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  Investor Match Notes Ledger
                </label>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-border/40 bg-accent/25 p-3.5 relative group shadow-sm flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Saved: {note.createdAt}
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans font-light">
                          {note.content}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-foreground/35 hover:text-red-400 p-1 rounded transition cursor-pointer bg-transparent border-0 shrink-0"
                        title="Delete Note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {notes.length === 0 && (
                    <div className="text-xs text-muted-foreground italic font-sans py-2">
                      No match notes added yet. Use the composer below to save your constraints.
                    </div>
                  )}
                </div>
              </div>

              {/* Note composer area */}
              <div className="grid gap-2 pt-3 border-t border-border/10">
                <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  Add Match Note / Constraint
                </label>
                <Textarea
                  placeholder="Type a new matching constraint or note (e.g. 'Must have SOC2 security compliance audit finished before Series A check release...')"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="min-h-[90px] bg-accent/30 border-border text-xs leading-relaxed"
                />
                <Button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim()}
                  className="w-fit rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold py-1.5 px-3 cursor-pointer mt-1"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Note to Ledger
                </Button>
              </div>

              {/* Save All changes button */}
              <div className="pt-3 border-t border-border/10">
                <Button
                  onClick={savePreferences}
                  disabled={saving}
                  className="w-fit rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save match criteria
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <aside className="space-y-8">
          {/* Visibility & links */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-serif font-light text-foreground">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                Visibility & links
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <RowSwitch
                label="Public profile"
                desc="Share a minimal, linkable profile."
                checked={publicProfile}
                onCheckedChange={(v) => updateVisibility("publicProfile", v)}
              />
              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground font-mono">Handle</div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono">@</span>
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    onBlur={(e) => updateVisibility("handle", e.target.value)}
                    className="h-8 bg-accent/30 border-border text-xs"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Profile URL: <span className="text-foreground font-medium">something.to/{handle || "alex_horizon"}</span>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground font-mono">Linked accounts</div>
                <div className="flex flex-wrap gap-2">
                  {profile?.links && profile.links.length > 0 ? (
                    profile.links.map((l, i) => (
                      <a
                        key={i}
                        href={l.href}
                        className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-accent/30 px-2.5 py-1.5 text-xs hover:bg-accent"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
                        {l.label}
                      </a>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground">No linked accounts</div>
                  )}
                  <button className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-accent/30 px-2 py-1 text-[11px] text-foreground/80 hover:bg-accent cursor-pointer">
                    Connect…
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio snapshot */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif font-light text-foreground">Portfolio snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {portfolioList.map((p) => (
                <Link
                  key={p.id}
                  href={`/investor/search/${p.id}`}
                  className="rounded-md border border-border/60 bg-accent/30 px-3 py-2 text-xs hover:bg-accent transition"
                >
                  {p.name}
                </Link>
              ))}
              {portfolioList.length === 0 && (
                <div className="text-xs text-muted-foreground font-mono">No active portfolio investments.</div>
              )}
              <div className="text-[10px] text-muted-foreground font-mono">Tap to view each brief.</div>
            </CardContent>
          </Card>

          {/* Accreditation Status */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-serif font-light text-foreground">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Accreditation Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {accreditedVerified ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3 text-xs text-emerald-400 font-mono">
                  <span className="flex items-center gap-1.5 font-bold mb-1">
                    <ShieldCheck className="h-4 w-4 animate-pulse" /> SEC 506(c) Accredited
                  </span>
                  Your status has been digitally self-certified and synced to escrow nodes.
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3 text-xs text-amber-500 font-mono space-y-3">
                  <p>Your accreditation status is currently unverified. Escrow disbursements require self-certification.</p>
                  <Button 
                    size="sm" 
                    onClick={() => setIsVerificationOpen(true)}
                    className="w-full bg-amber-500 text-black hover:bg-amber-400 text-xs font-semibold rounded-lg cursor-pointer h-8"
                  >
                    Certify Accreditation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guidance */}
          <Card className="bg-card/10 border-border/15 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif font-light text-foreground">Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-relaxed font-sans text-muted-foreground">
              <div className="rounded-md border border-border/60 bg-accent/30 px-3 py-2">
                Verified investors can enable &quot;Public profile&quot; to receive curated intros.
              </div>
              <div className="rounded-md border border-border/60 bg-accent/30 px-3 py-2 font-mono">
                Trust grows with NDA usage, escrow releases, and verified receipts.
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Accreditation self-certification Modal */}
      {isVerificationOpen && (
        <Dialog open={isVerificationOpen} onOpenChange={setIsVerificationOpen}>
          <DialogContent className="w-full max-w-md bg-[#101113] text-white border-white/5 p-6 rounded-xl">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="font-serif font-light text-xl text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                SEC Accreditation
              </DialogTitle>
              <DialogDescription className="text-xs text-white/50 font-mono">
                Digitally self-certify under Securities Act Rule 506(c)
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-2 text-xs leading-relaxed text-white/70">
              <p>
                To release escrow funds to active builder cohorts, you must certify that you meet the regulatory accredited investor guidelines:
              </p>
              
              <div className="space-y-2 border border-white/5 rounded-lg p-3 bg-white/[0.01]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="acc-criteria"
                    checked={verifyCriteria === "networth"}
                    onChange={() => setVerifyCriteria("networth")}
                    className="mt-0.5 accent-emerald-400"
                  />
                  <span><strong>Net Worth:</strong> Individual or joint net worth exceeds $1,000,000 (excluding primary residence).</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="acc-criteria"
                    checked={verifyCriteria === "income"}
                    onChange={() => setVerifyCriteria("income")}
                    className="mt-0.5 accent-emerald-400"
                  />
                  <span><strong>Income:</strong> Individual income exceeded $200,000 in each of the past 2 years (or $300,000 jointly).</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="acc-criteria"
                    checked={verifyCriteria === "web3"}
                    onChange={() => setVerifyCriteria("web3")}
                    className="mt-0.5 accent-emerald-400"
                  />
                  <span><strong>Ledger Account:</strong> Authenticated web3 signature demonstrating accredited check holdings.</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-white/5 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVerificationOpen(false)}
                className="h-8 text-xs rounded-lg border-white/10 text-white bg-transparent hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleVerifyAccreditation}
                className="h-8 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
              >
                Sign & Certify
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-[10px]">{label}</label>
      {children}
    </div>
  )
}

function RowSwitch({
  label,
  desc,
  checked,
  onCheckedChange,
}: {
  label: string
  desc?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-accent/30 p-3">
      <div className="min-w-0">
        <div className="font-medium text-xs text-foreground/80">{label}</div>
        {desc && <div className="text-[10px] text-muted-foreground leading-normal mt-0.5">{desc}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} className="data-[state=checked]:bg-[var(--brand-accent)] shrink-0" />
    </div>
  )
}

/* Three-State Toggle Component */
function ThreeStateToggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string
  desc?: string
  value: TechnicalPreferenceValue
  onChange: (v: TechnicalPreferenceValue) => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border bg-accent/30 p-3.5 shadow-sm">
      <div className="min-w-0">
        <div className="font-semibold text-xs text-foreground/90 uppercase tracking-wider">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground leading-normal mt-1">{desc}</div>}
      </div>
      <div className="flex bg-accent/60 rounded-lg p-0.5 border border-border/40 w-fit shrink-0">
        {(["yes", "maybe", "no"] as const).map((opt) => {
          const isActive = value === opt
          const activeColors = {
            yes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
            maybe: "bg-amber-500/10 text-amber-400 border-amber-500/25",
            no: "bg-rose-500/10 text-rose-400 border-rose-500/25",
          }[opt]
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-mono uppercase font-bold tracking-wider transition-all border border-transparent cursor-pointer",
                isActive
                  ? activeColors
                  : "text-foreground/45 hover:text-foreground/80 hover:bg-foreground/5"
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function safeInt(v: string, fallback: number) {
  const n = Number.parseInt(v)
  return Number.isFinite(n) ? n : fallback
}