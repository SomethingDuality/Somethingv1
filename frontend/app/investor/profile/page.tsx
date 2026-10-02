"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import apiClient, { assetUrl } from "@/lib/axios"
import { Switch } from "@/components/ui/switch"
import { apiError, cn } from "@/lib/utils"
import { Aside, countOf, Main, Page, PageTitle, pillClass, quietLinkClass, Section, Split } from "@/components/shell/page"

// Shared components
import { AvatarUploader } from "@/components/avatar-uploader"
import { useAvatar } from "@/components/avatar-context"
import { labelFor, list, normalize } from "@/lib/taxonomy"
import { toast } from "@/components/ui/use-toast"
import { SkeletonRows } from "@/components/visual/skeleton"
import { dateLabel } from "@/lib/format"

// Lists come from shared/taxonomy.json. State holds ids; the UI shows labels.
const PRESET_INTERESTS = list("sectors").map((e) => e.id)
const ALL_STAGES = list("fundingStages").map((e) => e.id)
const PRESET_STRUCTURES = list("legalStructures").map((e) => e.id)
const ALL_SUPERPOWERS = list("superpowers").map((e) => e.id)
const ALL_VEHICLES = list("vehicles").map((e) => e.id)

type TechnicalPreferenceValue = "yes" | "maybe" | "no"
type LeadStatus = "lead" | "follow" | "both"

type InvestorNote = {
  id: string
  content: string
  createdAt: string
}

type InvestorProfile = {
  name: string
  /** The saved photo (an /uploads path or an absolute URL), '' when there is none. */
  avatarUrl?: string
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
  vehicles?: string[]
  knownFields?: string[]
  superpowers?: string[]
  coInvestors?: string[]
  totalCapitalPool?: number
  linkedin?: string
  verification?: Verification
}

type Verification = {
  status: "none" | "pending" | "verified" | "rejected"
  linkedin: string
  submittedAt: string | null
  reviewedAt: string | null
  note: string
}


export default function InvestorProfilePage() {
  // The photo and name shown come from the server's profile; the shared context only mirrors them.
  const { setAvatarUrl, setUserName } = useAvatar()
  
  // Profile state
  const [profile, setProfile] = useState<InvestorProfile | null>(null)
  // Its own state: a new photo must not re-sync (and reset) the fields being edited below.
  const [avatar, setAvatar] = useState<string | null>(null)
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
  const [vehicles, setVehicles] = useState<string[]>([])
  const [superpowers, setSuperpowers] = useState<string[]>([])
  const [coInvestors, setCoInvestors] = useState<string[]>([])
  // Empty until the investor enters one: the server's $1M default is not their answer.
  const [pool, setPool] = useState("")

  // Input fields for adding custom tags
  const [newSectorInput, setNewSectorInput] = useState("")
  const [newKeywordInput, setNewKeywordInput] = useState("")
  const [newStructureInput, setNewStructureInput] = useState("")
  const [newCoInvestorInput, setNewCoInvestorInput] = useState("")


  // Fetch profile on mount, and again when the Something box saves an answer.
  useEffect(() => {
    fetchProfile()
    const onUpdate = () => { fetchProfile() }
    window.addEventListener("profile:updated", onUpdate)
    return () => window.removeEventListener("profile:updated", onUpdate)
  }, [])

  // The snapshot reads the same source as the Investments page (no local copy).
  const [portfolioList, setPortfolioList] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    apiClient
      .get<{ data: Array<{ ideaId: string; name: string }> }>("/investor/portfolio")
      .then((res) => setPortfolioList((res.data.data || []).map((r) => ({ id: r.ideaId, name: r.name }))))
      .catch(() => setPortfolioList([]))
  }, [])

  // Sync local state with profile
  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setUserName(profile.name)
      setAvatar(profile.avatarUrl || null)
      setAvatarUrl(profile.avatarUrl || null)
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
      setVehicles(profile.vehicles || [])
      setSuperpowers(profile.superpowers || [])
      setCoInvestors(profile.coInvestors || [])
      setPool(profile.knownFields?.includes("totalCapitalPool") && profile.totalCapitalPool ? String(profile.totalCapitalPool) : "")
    }
  }, [profile, setUserName, setAvatarUrl])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get<InvestorProfile>("/investor/profile")
      setProfile(response.data)
    } catch (err) {
      console.warn("Failed to load investor profile:", err)
      setError("Couldn't load your profile. Check your connection and reload.")
    } finally {
      setLoading(false)
    }
  }

  // Only send what the investor actually changed, so untouched defaults (e.g. a $5k min check)
  // never get recorded as their answer.
  const changedFields = (candidate: Record<string, unknown>) => {
    const base = (profile ?? {}) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(candidate).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(base[k]))
    )
  }

  const putChanges = async (path: string, candidate: Record<string, unknown>) => {
    const payload = changedFields(candidate)
    if (Object.keys(payload).length === 0) {
      toast({ title: "Nothing to save", description: "No changes since the last save." })
      return
    }
    try {
      setSaving(true)
      setError(null)
      const res = await apiClient.put<InvestorProfile>(path, payload)
      setProfile(res.data)
      toast({ title: "Saved" })
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast({ title: "Not saved", description: message || "Please try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = () =>
    putChanges("/investor/profile", {
      name, firm, minCheck, maxCheck, bio,
      ...(pool.trim() ? { totalCapitalPool: Number(pool) } : {}),
    })

  const savePreferences = () =>
    putChanges("/investor/preferences", {
      escrowPreference, ndaPreference, openSourcePreference, hardwarePreference, cryptographyPreference,
      pacePerQuarter, stageFocus, customMatchKeywords, leadStatus, legalStructures, vehicles, superpowers,
      coInvestors,
    })

  const updateInterests = async (newInterests: string[]) => {
    const previous = interests
    setInterests(newInterests)
    try {
      const res = await apiClient.put<InvestorProfile>("/investor/interests", { interests: newInterests })
      setProfile(res.data)
    } catch {
      setInterests(previous)
      toast({ title: "Sectors not saved", description: "Please try again.", variant: "destructive" })
    }
  }

  const updateVisibility = async (field: "publicProfile" | "handle", value: boolean | string) => {
    try {
      const res = await apiClient.put<InvestorProfile>("/investor/visibility", { [field]: value })
      setProfile(res.data)
      if (field === "publicProfile") setPublicProfile(value as boolean)
      if (field === "handle") setHandle(value as string)
    } catch {
      toast({ title: "Visibility not saved", description: "Please try again.", variant: "destructive" })
    }
  }

  const saveNotes = async (updatedNotes: InvestorNote[]) => {
    const previous = notes
    setNotes(updatedNotes)
    try {
      const res = await apiClient.put<InvestorProfile>("/investor/preferences", {
        notes: updatedNotes.map(({ content, createdAt }) => ({ content, createdAt })),
      })
      setProfile(res.data)
    } catch {
      setNotes(previous)
      toast({ title: "Note not saved", description: "Please try again.", variant: "destructive" })
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const response = await apiClient.post<{ url: string }>("/investor/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setAvatar(response.data.url)
      setAvatarUrl(response.data.url)
    } catch (err) {
      // No fake local preview: a blob: URL would vanish on reload and look like a saved photo.
      console.warn("Avatar upload failed:", err)
      toast({ title: "Photo not uploaded", description: "Use a PNG or JPG under 5 MB and try again.", variant: "destructive" })
    }
  }

  const toggleInterest = (tag: string) => {
    const newInterests = interests.includes(tag)
      ? interests.filter((t) => t !== tag)
      : [...interests, tag]
    updateInterests(newInterests)
  }

  const handleAddCustomSector = () => {
    const val = normalize("sectors", newSectorInput) ?? ""
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
    const val = normalize("legalStructures", newStructureInput) ?? ""
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

  const toggleVehicle = (v: string) => {
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
    setNewNoteText("")
    saveNotes([newNote, ...notes])
  }

  const handleDeleteNote = (noteId: string) => {
    saveNotes(notes.filter((n) => n.id !== noteId))
  }

  if (loading) {
    return <Page><SkeletonRows /></Page>
  }

  if (error && !profile) {
    return (
      <Page>
        <PageTitle title="Couldn't load your profile">{error}</PageTitle>
        <button type="button" onClick={fetchProfile} className={cn(quietLinkClass, "mt-8")}>Retry</button>
      </Page>
    )
  }

  const field = "w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
      on ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground",
    )
  const PREFS: Array<{ label: string; value: TechnicalPreferenceValue; set: (v: TechnicalPreferenceValue) => void }> = [
    { label: "Signing an NDA before seeing files", value: ndaPreference, set: setNdaPreference },
    { label: "Releasing money in milestones", value: escrowPreference, set: setEscrowPreference },
    { label: "Open-source products", value: openSourcePreference, set: setOpenSourcePreference },
    { label: "Hardware", value: hardwarePreference, set: setHardwarePreference },
    { label: "Crypto", value: cryptographyPreference, set: setCryptographyPreference },
  ]
  // A pace the investor actually chose that isn't one of the usual steps (the old slider allowed any)
  // gets its own chip; the schema default (4) is not an answer, so it stays unselected.
  const PACE_STEPS = [1, 3, 6, 10]
  const PACE = PACE_STEPS.includes(pacePerQuarter) || !profile?.knownFields?.includes("pacePerQuarter")
    ? PACE_STEPS
    : [...PACE_STEPS, pacePerQuarter].sort((a, b) => a - b)

  return (
    <Page>
      {/* Laptops (xl): how you invest on the left; sectors, visibility and portfolio on the right.
          On phones the right column follows the left one. */}
      <Split>
        <Main>
          <div className="flex items-start gap-6">
            <AvatarUploader
              name={profile?.name ?? ""}
              src={assetUrl(avatar) ?? null}
              onChange={(file) => {
                if (file) uploadAvatar(file)
              }}
              size={64}
            />
            <div className="min-w-0 flex-1">
              <PageTitle
                title={
                  <>
                    {profile?.name || "Your profile"}
                    {profile?.verification?.status === "verified" && (
                      <span className="mt-1 block text-[15px] text-muted-foreground sm:ml-3 sm:mt-0 sm:inline sm:align-middle">Verified investor</span>
                    )}
                  </>
                }
              />
              <p className="mt-2 text-[15px] text-muted-foreground">{firm || "Add your firm below, if you have one."}</p>
            </div>
          </div>

          <Section title="Basics">
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="i-name" className="block text-[15px] text-foreground">Name</label>
                  <input id="i-name" value={name} onChange={(e) => setName(e.target.value)} className={cn(field, "h-11")} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="i-firm" className="block text-[15px] text-foreground">Firm <span className="text-muted-foreground">(optional)</span></label>
                  <input id="i-firm" value={firm} onChange={(e) => setFirm(e.target.value)} className={cn(field, "h-11")} />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="i-min" className="block text-[15px] text-foreground">Smallest check, US dollars</label>
                  <input id="i-min" inputMode="numeric" value={minCheck} onChange={(e) => setMinCheck(safeInt(e.target.value, minCheck))} className={cn(field, "h-11")} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="i-max" className="block text-[15px] text-foreground">Largest check, US dollars</label>
                  <input id="i-max" inputMode="numeric" value={maxCheck} onChange={(e) => setMaxCheck(safeInt(e.target.value, maxCheck))} className={cn(field, "h-11")} />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="i-pool" className="block text-[15px] text-foreground">
                  Capital pool, US dollars <span className="text-muted-foreground">(optional; only you see it)</span>
                </label>
                <input
                  id="i-pool"
                  inputMode="numeric"
                  value={pool}
                  placeholder="What you plan to invest in total"
                  onChange={(e) => setPool(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                  className={cn(field, "h-11 sm:max-w-[50%]")}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="i-bio" className="block text-[15px] text-foreground">About you <span className="text-muted-foreground">(optional)</span></label>
                <textarea id="i-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className={cn(field, "resize-none py-3 leading-relaxed")} />
              </div>
              <button type="button" onClick={saveProfile} disabled={saving} className={pillClass}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </Section>

          <Section title="How you invest">
            <div className="space-y-8">
              <div>
                <p className="mb-3 text-[15px] text-foreground">Stages</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_STAGES.map((st) => (
                    <button key={st} type="button" onClick={() => toggleStage(st)} className={chip(stageFocus.includes(st))} aria-pressed={stageFocus.includes(st)}>
                      {labelFor("fundingStages", st)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">Do you lead rounds?</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: "lead", label: "I lead" },
                    { id: "follow", label: "I follow" },
                    { id: "both", label: "Either" },
                  ] as const).map((o) => (
                    <button key={o.id} type="button" onClick={() => setLeadStatus(o.id)} className={chip(leadStatus === o.id)} aria-pressed={leadStatus === o.id}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">Deals per quarter</p>
                <div className="flex flex-wrap gap-2">
                  {PACE.map((n) => (
                    <button key={n} type="button" onClick={() => setPacePerQuarter(n)} className={chip(pacePerQuarter === n)} aria-pressed={pacePerQuarter === n}>
                      {n === 10 ? "10 or more" : n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">How you put money in</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_VEHICLES.map((v) => (
                    <button key={v} type="button" onClick={() => toggleVehicle(v)} className={chip(vehicles.includes(v))} aria-pressed={vehicles.includes(v)}>
                      {labelFor("vehicles", v)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">Company types you can invest in</p>
                <div className="flex flex-wrap gap-2">
                  {legalStructures.filter((x) => !PRESET_STRUCTURES.includes(x)).map((x) => (
                    <button key={x} type="button" onClick={() => setLegalStructures((prev) => prev.filter((y) => y !== x))} className={chip(true)}>{x} ×</button>
                  ))}
                  {PRESET_STRUCTURES.map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setLegalStructures((prev) => (prev.includes(x) ? prev.filter((y) => y !== x) : [...prev, x]))}
                      className={chip(legalStructures.includes(x))}
                      aria-pressed={legalStructures.includes(x)}
                    >
                      {labelFor("legalStructures", x)}
                    </button>
                  ))}
                </div>
                <input
                  value={newStructureInput}
                  onChange={(e) => setNewStructureInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLegalStructure() } }}
                  placeholder="Another? Type it and press Enter"
                  className={cn(field, "mt-4 h-10 text-[15px]")}
                />
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">Help you can give founders</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_SUPERPOWERS.map((x) => (
                    <button key={x} type="button" onClick={() => toggleSuperpower(x)} className={chip(superpowers.includes(x))} aria-pressed={superpowers.includes(x)}>
                      {labelFor("superpowers", x)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">People you often invest with</p>
                {coInvestors.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {coInvestors.map((x) => (
                      <button key={x} type="button" onClick={() => setCoInvestors((prev) => prev.filter((y) => y !== x))} className={chip(true)}>{x} ×</button>
                    ))}
                  </div>
                )}
                <input
                  value={newCoInvestorInput}
                  onChange={(e) => setNewCoInvestorInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCoInvestor() } }}
                  placeholder="A name or firm, then Enter"
                  className={cn(field, "h-10 text-[15px]")}
                />
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">Your preferences</p>
                <ul className="divide-y divide-border border-y border-border">
                  {PREFS.map((pref) => (
                    <li key={pref.label} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[15px]">{pref.label}</span>
                      <span className="flex gap-2">
                        {(["yes", "maybe", "no"] as const).map((v) => (
                          <button key={v} type="button" onClick={() => pref.set(v)} className={chip(pref.value === v)} aria-pressed={pref.value === v}>
                            {v === "yes" ? "Yes" : v === "maybe" ? "Maybe" : "No"}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[15px] text-foreground">Words that should match you with ideas</p>
                {customMatchKeywords.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {customMatchKeywords.map((k) => (
                      <button key={k} type="button" onClick={() => setCustomMatchKeywords((prev) => prev.filter((x) => x !== k))} className={chip(true)}>{k} ×</button>
                    ))}
                  </div>
                )}
                <input
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddKeyword() } }}
                  placeholder="e.g. carbon credits, then Enter"
                  className={cn(field, "h-10 text-[15px]")}
                />
              </div>
              <button type="button" onClick={savePreferences} disabled={saving} className={pillClass}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </Section>

          <Section title="Private notes">
            <form onSubmit={(e) => { e.preventDefault(); handleAddNote() }} className="flex flex-col gap-3 sm:flex-row">
              <input
                aria-label="New note"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Only you can see these"
                className="h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-full border border-input bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
              />
              <button type="submit" disabled={!newNoteText.trim()} className={pillClass}>Add note</button>
            </form>
            {notes.length > 0 && (
              <ul className="mt-6 divide-y divide-border">
                {notes.map((n) => (
                  <li key={n.id} className="flex items-baseline justify-between gap-6 py-4">
                    <span className="text-[15px] leading-relaxed">{n.content}</span>
                    <span className="flex shrink-0 gap-4 text-xs text-muted-foreground">
                      {n.createdAt}
                      <button type="button" onClick={() => handleDeleteNote(n.id)} className="hover:text-foreground cursor-pointer">Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Main>

        <Aside>
          <Section title="Sectors">
            <div className="flex flex-wrap gap-2">
              {interests.map((t) => (
                <button key={t} type="button" onClick={() => toggleInterest(t)} className={chip(true)} aria-label={`Remove ${labelFor("sectors", t)}`}>
                  {labelFor("sectors", t)} ×
                </button>
              ))}
              {PRESET_INTERESTS.filter((t) => !interests.includes(t)).map((t) => (
                <button key={t} type="button" onClick={() => toggleInterest(t)} className={chip(false)}>{labelFor("sectors", t)}</button>
              ))}
            </div>
            <input
              value={newSectorInput}
              onChange={(e) => setNewSectorInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomSector() } }}
              placeholder="Another sector? Type it and press Enter"
              className={cn(field, "mt-4 h-10 text-[15px]")}
            />
            <p className="mt-3 text-sm text-muted-foreground">Saved as you tap.</p>
          </Section>

          <Section title="Trust">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              <span className="text-foreground">{profile?.trust ?? 0} of 100.</span>{" "}
              Built from what you do here: {countOf(profile?.trustBreakdown?.history ?? 0, "commitment")} (1 point each)
              and {countOf(profile?.trustBreakdown?.escrowReleases ?? 0, "release")} (5 each). Signed NDAs and receipts will
              count once Something records them. Only you see this.
            </p>
          </Section>

          <Section title="Who can see you">
            <label className="flex items-center justify-between gap-6">
              <span className="text-[15px]">
                Public profile
                <span className="block text-sm text-muted-foreground">Founders can find you and your sectors.</span>
              </span>
              <Switch checked={publicProfile} onCheckedChange={(v) => updateVisibility("publicProfile", v)} />
            </label>
            {publicProfile && (
              <div className="mt-6 space-y-2">
                <label htmlFor="i-handle" className="block text-[15px] text-foreground">Your handle</label>
                <input
                  id="i-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onBlur={(e) => updateVisibility("handle", e.target.value)}
                  placeholder="yourname"
                  className={cn(field, "h-11 max-w-xs")}
                />
              </div>
            )}
          </Section>

          <Section title="Portfolio" action={portfolioList.length > 0 ? <Link href="/investor/investments" className="hover:text-foreground">Investments</Link> : undefined}>
            {portfolioList.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Ideas you commit to will be listed here.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {portfolioList.map((pf) => (
                  <li key={pf.id}>
                    <Link href={`/investor/search/${pf.id}`} className="block py-4 text-[15px] hover:underline underline-offset-4">{pf.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <VerificationSection profile={profile} onChange={setProfile} />
        </Aside>
      </Split>
    </Page>
  )
}



/* Three-State Toggle Component */

function safeInt(v: string, fallback: number) {
  const n = Number.parseInt(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * P13: an investor is verified by their LinkedIn plus a check by hand. Founders then see
 * "verified investor" next to their name when they commit.
 */
function VerificationSection({ profile, onChange }: { profile: InvestorProfile | null; onChange: (p: InvestorProfile) => void }) {
  const v = profile?.verification
  const [link, setLink] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLink(v?.linkedin || profile?.linkedin || "")
  }, [v?.linkedin, profile?.linkedin])

  const submit = async () => {
    if (!link.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await apiClient.post<InvestorProfile>("/investor/verification", { linkedin: link.trim() })
      onChange(res.data)
    } catch (err) {
      setError(apiError(err, "Couldn't send the request."))
    } finally {
      setSending(false)
    }
  }

  const status = v?.status ?? "none"
  return (
    <Section title="Verification">
      {status === "verified" ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          <span className="text-foreground">Verified</span>
          {v?.reviewedAt ? ` on ${dateLabel(v.reviewedAt)}` : ""}. Founders see &ldquo;verified investor&rdquo; next to your name.
        </p>
      ) : status === "pending" ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          <span className="text-foreground">Waiting for review.</span> Sent {v?.submittedAt ? dateLabel(v.submittedAt) : ""} with{" "}
          <a href={v?.linkedin} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">your LinkedIn</a>. Someone checks it by hand.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-4">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {status === "rejected"
              ? <>Not approved: <span className="text-foreground">{v?.note}</span> You can send another link.</>
              : "Add your LinkedIn and someone checks it by hand. Founders then see you're a verified investor."}
          </p>
          <input
            aria-label="Your LinkedIn link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="linkedin.com/in/you"
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
          />
          {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}
          <button type="submit" disabled={!link.trim() || sending} className={pillClass}>{sending ? "Sending…" : "Ask to be verified"}</button>
        </form>
      )}
    </Section>
  )
}
