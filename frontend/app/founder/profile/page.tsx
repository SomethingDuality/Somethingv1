"use client"

import { useState, useEffect, useRef } from "react"
import apiClient, { assetUrl } from "@/lib/axios"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Aside, Main, Page, PageTitle, Section, Split, pillClass, quietLinkClass } from "@/components/shell/page"
import { labelFor, normalize, options } from "@/lib/taxonomy"
import { toast as notify } from "@/components/ui/use-toast"
import { useAuth } from "@/components/auth-provider"
import { avatarTone } from "@/lib/visual"

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
  email?: string
  avatarUrl: string
  headline: string
  location: string
  isVerified: boolean
  about: string
  socials: {
    linkedin: string
    twitter: string
    website: string
    github?: string
  }
  experience_level?: string
  occupation?: string
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
  socials: { linkedin: '', twitter: '', website: '', github: '' },
  experience_level: '',
  occupation: '',
  skills: [],
  experience: [],
  education: [],
  interests: [],
  profileCompletion: 0,
  githubVerified: false,
  walletVerified: false,
}

// Accent palette configurations (matched with settings)


export default function FounderProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE)

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

  // Inputs for headers
  const [editName, setEditName] = useState("")
  const [editHeadline, setEditHeadline] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [editLinkedin, setEditLinkedin] = useState("")
  const [editTwitter, setEditTwitter] = useState("")
  const [editWebsite, setEditWebsite] = useState("")
  const [editGithub, setEditGithub] = useState("")
  const [editExperienceLevel, setEditExperienceLevel] = useState("")
  const [editOccupation, setEditOccupation] = useState("")
  const [editAbout, setEditAbout] = useState("")

  // Skill & Interest Inputs
  const [newSkillText, setNewSkillText] = useState("")
  const [newInterestText, setNewInterestText] = useState("")

  const [saving, setSaving] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)


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
      setProfile((prev) => ({ ...prev, avatarUrl: res.data.avatarUrl }))
      refreshMe()
      addToast("Photo updated")
    } catch (err) {
      console.warn("Avatar upload failed", err)
      setProfile((prev) => ({ ...prev, avatarUrl: profile.avatarUrl }))
      addToast("Photo not uploaded", "Use a PNG or JPG under 5 MB and try again.", "error")
    }
  }

  // Add Toast Notification helper
  const addToast = (title: string, description?: string, type: "success" | "error" | "info" = "success") => {
    notify({ title, description, variant: type === "error" ? "destructive" : "default" })
  }

  // Load profile from the API (no local cache: a stale copy used to overwrite real data).
  const { refreshMe } = useAuth()

  const fetchLocalProfile = async () => {
    if (typeof window === "undefined") return

    try {
      const res = await apiClient.get<ProfileData>("/founder/profile")
      setProfile({ ...EMPTY_PROFILE, ...res.data, socials: { ...EMPTY_PROFILE.socials, ...(res.data.socials || {}) } })
    } catch {
      addToast("Couldn't load your profile", "Check your connection and reload.", "error")
    }
  }

  useEffect(() => {
    fetchLocalProfile()
    // The Something box fires this after an answer so the page shows it without a reload.
    const handleUpdate = () => { fetchLocalProfile() }
    window.addEventListener("profile:updated", handleUpdate)
    return () => window.removeEventListener("profile:updated", handleUpdate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate dynamic profile completion percentage
  const getDynamicCompletion = (data: ProfileData) => {
    let score = 0
    // Only what a founder can do today counts; GitHub/wallet verification is "Coming soon".
    // Same weights as computeCompletion in the backend's founder.controller.js.
    if (data.name && data.name !== "Unnamed Node") score += 20
    if (data.about && data.about.trim().length > 10) score += 30
    if (data.experience && (data.experience || []).length > 0) score += 30
    if (data.education && (data.education || []).length > 0) score += 20
    return Math.min(score, 100)
  }

  // Save profile: send only what changed, wait for the server, roll back and say so on failure.
  const saveProfileData = async (updated: ProfileData): Promise<boolean> => {
    const previous = profile
    const candidate: Record<string, unknown> = {
      name: updated.name, headline: updated.headline, location: updated.location, about: updated.about,
      skills: updated.skills, interests: updated.interests, experience: updated.experience, education: updated.education,
      experience_level: updated.experience_level, occupation: updated.occupation,
    }
    const payload = Object.fromEntries(
      Object.entries(candidate).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((previous as unknown as Record<string, unknown>)[k]))
    )
    const socialsChanged = Object.fromEntries(
      Object.entries(updated.socials).filter(([k, v]) => v !== (previous.socials as Record<string, string | undefined>)[k])
    )
    if (Object.keys(socialsChanged).length) payload.socials = socialsChanged
    if (Object.keys(payload).length === 0) return true

    setProfile({ ...updated, profileCompletion: getDynamicCompletion(updated) })
    try {
      const res = await apiClient.put<ProfileData>("/founder/profile", payload)
      setProfile({ ...EMPTY_PROFILE, ...res.data, socials: { ...EMPTY_PROFILE.socials, ...(res.data.socials || {}) } })
      if ("name" in payload) refreshMe()
      return true
    } catch (err) {
      setProfile(previous)
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      addToast("Not saved", message || "Please try again.", "error")
      return false
    }
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
      setEditGithub(profile.socials.github || "")
      setEditExperienceLevel(profile.experience_level || "")
      setEditOccupation(profile.occupation || "")
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
      updated.socials  = { linkedin: editLinkedin, twitter: editTwitter, website: editWebsite, github: editGithub }
      updated.experience_level = editExperienceLevel
      updated.occupation = editOccupation
    } else if (editMode === "about") {
      updated.about = editAbout
    }

    const ok = await saveProfileData(updated)
    setSaving(false)
    if (ok) {
      setEditMode(null)
      addToast("Profile updated")
    }
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

  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault()
    const newExp: Experience = {
      role: expRole,
      company: expCompany,
      duration: expDuration,
      description: expDesc
    }

    const updatedExpList = [...profile.experience]
    if (editingExpIndex !== null) updatedExpList[editingExpIndex] = newExp
    else updatedExpList.unshift(newExp)

    if (await saveProfileData({ ...profile, experience: updatedExpList })) {
      addToast(editingExpIndex !== null ? "Experience updated" : "Experience added")
      setExpModalOpen(false)
    }
  }

  const handleDeleteExperience = (index: number) => {
    const item = profile.experience[index]
    const updatedExpList = profile.experience.filter((_, i) => i !== index)
    saveProfileData({ ...profile, experience: updatedExpList }).then((ok) => {
      if (ok) addToast("Experience removed", `Removed ${item.role}.`)
    })
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

  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault()
    const newEdu: Education = {
      institution: eduInstitution,
      degree: eduDegree,
      duration: eduDuration
    }

    const updatedEduList = [...profile.education]
    if (editingEduIndex !== null) updatedEduList[editingEduIndex] = newEdu
    else updatedEduList.unshift(newEdu)

    if (await saveProfileData({ ...profile, education: updatedEduList })) {
      addToast(editingEduIndex !== null ? "Education updated" : "Education added")
      setEduModalOpen(false)
    }
  }

  const handleDeleteEducation = (index: number) => {
    const item = profile.education[index]
    const updatedEduList = profile.education.filter((_, i) => i !== index)
    saveProfileData({ ...profile, education: updatedEduList }).then((ok) => {
      if (ok) addToast("Education removed", `Removed ${item.institution}.`)
    })
  }

  // Skills and interests are stored as taxonomy ids; typed values map to a known id when they match.
  const addTag = (field: "skills" | "interests", raw: string) => {
    const kind = field === "skills" ? "skills" : "sectors"
    const id = normalize(kind, raw)
    if (!id || profile[field].includes(id)) return
    saveProfileData({ ...profile, [field]: [...profile[field], id] })
  }
  const removeTag = (field: "skills" | "interests", id: string) => {
    saveProfileData({ ...profile, [field]: profile[field].filter((t) => t !== id) })
  }

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag("skills", newSkillText)
      setNewSkillText("")
    }
  }
  const handleRemoveSkill = (tag: string) => removeTag("skills", tag)

  const handleAddInterest = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag("interests", newInterestText)
      setNewInterestText("")
    }
  }
  const handleRemoveInterest = (tag: string) => removeTag("interests", tag)

  const field = "w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
  const dialogClass = "w-full max-w-md rounded-2xl border-border bg-popover p-8 text-popover-foreground"
  const chipOn = "rounded-full border border-foreground bg-foreground px-3.5 py-1.5 text-sm text-background cursor-pointer"
  const chipOff = "rounded-full border border-input px-3.5 py-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
  const links = [
    { label: "LinkedIn", href: profile.socials.linkedin },
    { label: "X", href: profile.socials.twitter && (profile.socials.twitter.startsWith("http") ? profile.socials.twitter : `https://x.com/${profile.socials.twitter.replace(/^@/, "")}`) },
    { label: "GitHub", href: profile.socials.github },
    { label: "Website", href: profile.socials.website },
  ].filter((l) => l.href)
  const missing = [
    !(profile.about && profile.about.trim().length > 10) && { label: "a short bio", open: () => openEditModal("about") },
    profile.experience.length === 0 && { label: "a role", open: () => handleOpenExpModal(null) },
    profile.education.length === 0 && { label: "where you studied", open: () => handleOpenEduModal(null) },
  ].filter(Boolean) as { label: string; open: () => void }[]
  const sub = [profile.headline, profile.location].filter(Boolean)

  return (
    <Page>
      {/* Laptops (xl): the story on the left; skills, sectors and verification on the right.
          On phones the right column follows the left one. */}
      <Split>
        <Main>
          <div className="flex items-start gap-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full text-lg cursor-pointer"
              style={{ backgroundColor: avatarTone(profile.name || "?")[0], color: avatarTone(profile.name || "?")[1] }}
              aria-label="Change photo"
              title="Change photo"
            >
              {profile.avatarUrl && !profile.avatarUrl.startsWith("linear-gradient") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrl(profile.avatarUrl)} alt="" className="size-full object-cover" />
              ) : (
                <span>{getInitials(profile.name)}</span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatarUpload} />
            <div className="min-w-0 flex-1">
              <PageTitle
                title={profile.name || "Your profile"}
                actions={<button type="button" onClick={() => openEditModal("header")} className={quietLinkClass}>Edit</button>}
              />
              {sub.length > 0 && <p className="mt-2 text-[15px] text-muted-foreground">{sub.join(", ")}</p>}
              {links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  {links.map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-[15px] text-foreground underline-offset-4 hover:underline">
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {missing.length > 0 && (
            <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
              Your profile is {profile.profileCompletion}% complete. Add{" "}
              {missing.map((m, i) => (
                <span key={m.label}>
                  {i > 0 && (i === missing.length - 1 ? " and " : ", ")}
                  <button type="button" onClick={m.open} className="text-foreground underline underline-offset-4 cursor-pointer">{m.label}</button>
                </span>
              ))}
              .
            </p>
          )}

          <Section title="About" action={<button type="button" onClick={() => openEditModal("about")} className="hover:text-foreground cursor-pointer">Edit</button>}>
            {profile.about ? (
              <p className="max-w-[65ch] whitespace-pre-line text-base leading-relaxed text-foreground/90">{profile.about}</p>
            ) : (
              <p className="text-[15px] text-muted-foreground">A few sentences about you: what you&apos;ve built and what you want to build next.</p>
            )}
          </Section>

          <Section title="Experience" action={<button type="button" onClick={() => handleOpenExpModal(null)} className="hover:text-foreground cursor-pointer">Add</button>}>
            {profile.experience.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Roles you&apos;ve had, jobs or projects.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {profile.experience.map((exp, i) => (
                  <li key={`${exp.role}-${i}`} className="py-5">
                    <div className="flex items-baseline justify-between gap-6">
                      <span className="text-base text-foreground">{exp.role}{exp.company ? `, ${exp.company}` : ""}</span>
                      <span className="flex shrink-0 gap-4 text-sm text-muted-foreground">
                        <button type="button" onClick={() => handleOpenExpModal(i)} className="hover:text-foreground cursor-pointer">Edit</button>
                        <button type="button" onClick={() => handleDeleteExperience(i)} className="hover:text-foreground cursor-pointer">Remove</button>
                      </span>
                    </div>
                    {exp.duration && <p className="mt-1 text-sm text-muted-foreground">{exp.duration}</p>}
                    {exp.description && <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-foreground/90">{exp.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Education" action={<button type="button" onClick={() => handleOpenEduModal(null)} className="hover:text-foreground cursor-pointer">Add</button>}>
            {profile.education.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Where you studied, if you&apos;d like to say.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {profile.education.map((edu, i) => (
                  <li key={`${edu.institution}-${i}`} className="py-5">
                    <div className="flex items-baseline justify-between gap-6">
                      <span className="text-base text-foreground">{edu.institution}</span>
                      <span className="flex shrink-0 gap-4 text-sm text-muted-foreground">
                        <button type="button" onClick={() => handleOpenEduModal(i)} className="hover:text-foreground cursor-pointer">Edit</button>
                        <button type="button" onClick={() => handleDeleteEducation(i)} className="hover:text-foreground cursor-pointer">Remove</button>
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{[edu.degree, edu.duration].filter(Boolean).join(", ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Main>

        <Aside>
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <button key={skill} type="button" onClick={() => handleRemoveSkill(skill)} className={chipOn} aria-label={`Remove ${labelFor("skills", skill)}`}>
                  {labelFor("skills", skill)} ×
                </button>
              ))}
              {options("skills").filter((o) => !profile.skills.includes(o.value)).map((o) => (
                <button key={o.value} type="button" onClick={() => addTag("skills", o.value)} className={chipOff}>
                  {o.label}
                </button>
              ))}
            </div>
            <input
              value={newSkillText}
              onChange={(e) => setNewSkillText(e.target.value)}
              onKeyDown={handleAddSkill}
              placeholder="Another skill? Type it and press Enter"
              className={cn(field, "mt-4 h-10 text-[15px]")}
            />
          </Section>

          <Section title="Sectors you care about">
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((it) => (
                <button key={it} type="button" onClick={() => handleRemoveInterest(it)} className={chipOn} aria-label={`Remove ${labelFor("sectors", it)}`}>
                  {labelFor("sectors", it)} ×
                </button>
              ))}
              {options("sectors").filter((o) => !profile.interests.includes(o.value)).map((o) => (
                <button key={o.value} type="button" onClick={() => addTag("interests", o.value)} className={chipOff}>
                  {o.label}
                </button>
              ))}
            </div>
            <input
              value={newInterestText}
              onChange={(e) => setNewInterestText(e.target.value)}
              onKeyDown={handleAddInterest}
              placeholder="Another sector? Type it and press Enter"
              className={cn(field, "mt-4 h-10 text-[15px]")}
            />
          </Section>

          <Section title="Verification">
            <p className="text-[15px] text-muted-foreground">Connecting GitHub and a wallet to prove your work is coming soon.</p>
          </Section>
        </Aside>
      </Split>

      {/* Name, headline and links */}
      <Dialog open={editMode === "header"} onOpenChange={() => !saving && setEditMode(null)}>
        <DialogContent className={cn(dialogClass, "max-h-[90vh] overflow-y-auto")}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-medium">Edit profile</DialogTitle>
            <DialogDescription className="text-[15px] text-muted-foreground">Only your name is required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProfile} className="mt-2 space-y-5">
            {[
              { id: "p-name", label: "Name", value: editName, set: setEditName, required: true },
              { id: "p-headline", label: "Headline", value: editHeadline, set: setEditHeadline, placeholder: "e.g. Building tools for campus libraries" },
              { id: "p-location", label: "Where you're based", value: editLocation, set: setEditLocation },
              { id: "p-linkedin", label: "LinkedIn", value: editLinkedin, set: setEditLinkedin, placeholder: "linkedin.com/in/you" },
              { id: "p-twitter", label: "X", value: editTwitter, set: setEditTwitter, placeholder: "@you" },
              { id: "p-github", label: "GitHub", value: editGithub, set: setEditGithub, placeholder: "github.com/you" },
              { id: "p-website", label: "Website", value: editWebsite, set: setEditWebsite },
            ].map((f) => (
              <div key={f.id} className="space-y-2">
                <label htmlFor={f.id} className="block text-[15px] text-foreground">{f.label}</label>
                <input id={f.id} value={f.value} required={f.required} placeholder={f.placeholder} onChange={(e) => f.set(e.target.value)} className={cn(field, "h-11")} />
              </div>
            ))}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="p-experience" className="block text-[15px] text-foreground">Experience</label>
                <select id="p-experience" value={editExperienceLevel} onChange={(e) => setEditExperienceLevel(e.target.value)} className={cn(field, "h-11 bg-popover")}>
                  <option value="">Not set</option>
                  {options("experienceLevels").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="p-occupation" className="block text-[15px] text-foreground">What you do</label>
                <select id="p-occupation" value={editOccupation} onChange={(e) => setEditOccupation(e.target.value)} className={cn(field, "h-11 bg-popover")}>
                  <option value="">Not set</option>
                  {options("occupations").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-5 pt-2">
              <button type="button" onClick={() => setEditMode(null)} className={quietLinkClass}>Cancel</button>
              <button type="submit" disabled={saving} className={pillClass}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* About */}
      <Dialog open={editMode === "about"} onOpenChange={() => !saving && setEditMode(null)}>
        <DialogContent className={dialogClass}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-medium">About you</DialogTitle>
            <DialogDescription className="text-[15px] text-muted-foreground">What you&apos;ve built and what you want to build next.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProfile} className="mt-2 space-y-5">
            <textarea value={editAbout} onChange={(e) => setEditAbout(e.target.value)} rows={7} className={cn(field, "resize-none py-3 leading-relaxed")} />
            <div className="flex items-center justify-end gap-5">
              <button type="button" onClick={() => setEditMode(null)} className={quietLinkClass}>Cancel</button>
              <button type="submit" disabled={saving} className={pillClass}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Experience */}
      <Dialog open={expModalOpen} onOpenChange={setExpModalOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-medium">{editingExpIndex !== null ? "Edit role" : "Add a role"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveExperience} className="mt-2 space-y-5">
            {[
              { id: "exp-role", label: "Role", value: expRole, set: setExpRole, required: true, placeholder: "e.g. Engineer" },
              { id: "exp-company", label: "Company or project", value: expCompany, set: setExpCompany, required: true },
              { id: "exp-duration", label: "When", value: expDuration, set: setExpDuration, placeholder: "e.g. 2023 to now" },
            ].map((f) => (
              <div key={f.id} className="space-y-2">
                <label htmlFor={f.id} className="block text-[15px] text-foreground">{f.label}</label>
                <input id={f.id} value={f.value} required={f.required} placeholder={f.placeholder} onChange={(e) => f.set(e.target.value)} className={cn(field, "h-11")} />
              </div>
            ))}
            <div className="space-y-2">
              <label htmlFor="exp-desc" className="block text-[15px] text-foreground">What you did <span className="text-muted-foreground">(optional)</span></label>
              <textarea id="exp-desc" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} rows={3} className={cn(field, "resize-none py-3 leading-relaxed")} />
            </div>
            <div className="flex items-center justify-end gap-5">
              <button type="button" onClick={() => setExpModalOpen(false)} className={quietLinkClass}>Cancel</button>
              <button type="submit" className={pillClass}>Save</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Education */}
      <Dialog open={eduModalOpen} onOpenChange={setEduModalOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-medium">{editingEduIndex !== null ? "Edit education" : "Add education"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEducation} className="mt-2 space-y-5">
            {[
              { id: "edu-institution", label: "School or university", value: eduInstitution, set: setEduInstitution, required: true },
              { id: "edu-degree", label: "Degree or course", value: eduDegree, set: setEduDegree },
              { id: "edu-duration", label: "When", value: eduDuration, set: setEduDuration, placeholder: "e.g. 2019 to 2023" },
            ].map((f) => (
              <div key={f.id} className="space-y-2">
                <label htmlFor={f.id} className="block text-[15px] text-foreground">{f.label}</label>
                <input id={f.id} value={f.value} required={f.required} placeholder={f.placeholder} onChange={(e) => f.set(e.target.value)} className={cn(field, "h-11")} />
              </div>
            ))}
            <div className="flex items-center justify-end gap-5">
              <button type="button" onClick={() => setEduModalOpen(false)} className={quietLinkClass}>Cancel</button>
              <button type="submit" className={pillClass}>Save</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
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
