"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { normalize, options } from "@/lib/taxonomy"
import { IdeaPrivacyNote } from "@/components/idea-privacy-note"

type Stage = "concept" | "prototype" | "mvp" | "launched"
// "" = not set yet: only title and description are required to post.
type StageValue = Stage | ""

export interface Attachment {
  name: string
  size: string
  type: "presentation" | "video" | "audio" | "document"
  url?: string       // populated after server upload
  file?: File        // transient — only present before upload, not persisted
}

interface IdeaFormData {
  title: string
  description: string
  stage: StageValue
  lookingFor: string[]
  raising: string
  tags: string[]
  isDraft: boolean
  attachments?: Attachment[]
}

interface Idea {
  id: string
  title: string
  description?: string
  desc?: string
  stage?: StageValue
  lookingFor?: string[]
  raising?: string
  tags: string[]
  isDraft?: boolean
  attachments?: Attachment[]
}

interface PostIdeaModalProps {
  trigger?: React.ReactNode
  isOpen?: boolean
  onClose?: () => void
  /** Rejects with a user-facing message on failure; the modal then stays open with the text kept. */
  onSubmit: (data: IdeaFormData) => Promise<void> | void
  onDelete?: () => Promise<void> | void
  editingIdea?: Idea | null
  /** Prefills the description of a new idea (from the founder home's box). */
  initialDescription?: string
}

// Stages, sectors and roles come from shared/taxonomy.json; ids are stored, labels are shown.
const STAGES = options("ideaStages")
const RAISING = options("raisingBands")

// Suggestions come from shared/taxonomy.json; ids are stored, labels are shown.
const SUGGESTED_ROLES = options("roles")
const SUGGESTED_TAGS = options("sectors")

const EMPTY_FORM: IdeaFormData = {
  title: "",
  description: "",
  stage: "",
  lookingFor: [],
  raising: "",
  tags: [],
  isDraft: false,
  attachments: [],
}

export function PostIdeaModal({
  trigger,
  isOpen: controlledOpen,
  onClose,
  onSubmit,
  onDelete,
  editingIdea,
  initialDescription = "",
}: PostIdeaModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formData, setFormData] = useState<IdeaFormData>(EMPTY_FORM)
  const [showDetails, setShowDetails] = useState(false)
  const [newRole, setNewRole] = useState("")
  const [newTag, setNewTag] = useState("")
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const isEditing = !!editingIdea

  useEffect(() => {
    if (editingIdea) {
      setFormData({
        title: editingIdea.title || "",
        description: editingIdea.description || editingIdea.desc || "",
        stage: editingIdea.stage || "",
        lookingFor: editingIdea.lookingFor || [],
        raising: editingIdea.raising || "",
        tags: editingIdea.tags || [],
        isDraft: editingIdea.isDraft || false,
        attachments: editingIdea.attachments || [],
      })
      // Show the optional details when editing an idea that already has some.
      setShowDetails(Boolean(editingIdea.stage || editingIdea.raising || editingIdea.tags?.length || editingIdea.lookingFor?.length || editingIdea.attachments?.length))
    } else {
      setFormData({ ...EMPTY_FORM, description: initialDescription })
      setShowDetails(false)
    }
    setSubmitError(null)
  }, [editingIdea, isOpen, initialDescription])

  const handleOpenChange = (open: boolean): void => {
    if (controlledOpen !== undefined) {
      if (!open && onClose) onClose()
    } else {
      setInternalOpen(open)
    }
  }

  const kindOf = (file: File): Attachment["type"] => {
    const ext = file.name.toLowerCase().split(".").pop() ?? ""
    if (["ppt", "pptx", "key"].includes(ext)) return "presentation"
    if (["mp4", "mov", "webm"].includes(ext) || file.type.startsWith("video/")) return "video"
    if (["mp3", "wav", "m4a"].includes(ext) || file.type.startsWith("audio/")) return "audio"
    return "document"
  }

  const sizeLabel = (bytes: number) =>
    bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const list = Array.from(files)
    const isZip = (f: File) => f.name.toLowerCase().endsWith(".zip") || f.type === "application/zip" || f.type === "application/x-zip-compressed"
    if (list.some(isZip)) {
      toast({ title: "ZIP files aren't allowed", description: "Attach the slides, video or document itself.", variant: "destructive" })
      return
    }
    setFormData((prev) => ({
      ...prev,
      // keep the File object so the parent can upload it after the idea is saved
      attachments: [...(prev.attachments || []), ...list.map((file) => ({ name: file.name, size: sizeLabel(file.size), type: kindOf(file), file }))],
    }))
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments?.filter((_, i) => i !== index) || [],
    }))
  }

  // Clear and close only after the save succeeds; on failure the founder's text stays put.
  const handleSubmit = async (isDraft: boolean) => {
    if (!formData.title.trim() || !formData.description.trim() || saving) return
    setSaving(true)
    setSubmitError(null)
    try {
      await onSubmit({ ...formData, isDraft })
      setFormData(EMPTY_FORM)
      handleOpenChange(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Not saved. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingIdea || !onDelete || saving) return
    setShowDeleteDialog(false)
    setSaving(true)
    setSubmitError(null)
    try {
      await onDelete()
      handleOpenChange(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Not deleted. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = (role: string): void => {
    const trimmed = normalize("roles", role)
    if (!trimmed) return
    
    if (formData.lookingFor.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        lookingFor: prev.lookingFor.filter((r) => r !== trimmed),
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        lookingFor: [...prev.lookingFor, trimmed],
      }))
    }
  }

  const toggleTag = (tag: string): void => {
    const trimmed = normalize("sectors", tag)
    if (!trimmed) return

    if (formData.tags.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        tags: prev.tags.filter((t) => t !== trimmed),
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmed],
      }))
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, action: () => void): void => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
  }

  const canSave = Boolean(formData.title.trim() && formData.description.trim()) && !saving
  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
      on ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground",
    )
  const field = "w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
  const customSectors = formData.tags.filter((t) => !SUGGESTED_TAGS.some((o) => o.value === t))
  const customRoles = formData.lookingFor.filter((r) => !SUGGESTED_ROLES.some((o) => o.value === r))

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-popover p-0 text-popover-foreground sm:max-w-[640px]">
          <DialogHeader className="px-8 pt-8 text-left">
            <DialogTitle className="text-2xl font-medium">{isEditing ? "Edit idea" : "New idea"}</DialogTitle>
            <DialogDescription className="text-[15px] text-muted-foreground">
              A title and a few sentences are enough. Everything else is optional.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-7 overflow-y-auto px-8 py-7">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="title" className="text-[15px] text-foreground">Title</label>
                <span className="text-xs text-muted-foreground tabular-nums">{formData.title.length}/50</span>
              </div>
              <input
                id="title"
                maxLength={50}
                placeholder="What should people call it?"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className={cn(field, "h-11")}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="description" className="text-[15px] text-foreground">Description</label>
                <span className="text-xs text-muted-foreground tabular-nums">{formData.description.length}/500</span>
              </div>
              <textarea
                id="description"
                maxLength={500}
                rows={5}
                placeholder="What problem does it solve, and for whom?"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className={cn(field, "resize-none py-3 leading-relaxed")}
              />
              <IdeaPrivacyNote />
            </div>

            {/* Everything below is optional; the Something box asks for missing details later. */}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              className="flex items-center gap-2 text-[15px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
              Add stage, raising, sectors, roles or files
            </button>

            {showDetails && (
              <div className="space-y-8">
                <fieldset className="space-y-3">
                  <legend className="text-[15px] text-foreground">Stage</legend>
                  <div className="flex flex-wrap gap-2 pt-3">
                    {STAGES.map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        aria-pressed={formData.stage === st.value}
                        onClick={() => setFormData((prev) => ({ ...prev, stage: prev.stage === st.value ? "" : (st.value as Stage) }))}
                        className={chip(formData.stage === st.value)}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-[15px] text-foreground">Raising</legend>
                  <div className="flex flex-wrap gap-2 pt-3">
                    {RAISING.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        aria-pressed={formData.raising === r.value}
                        onClick={() => setFormData((prev) => ({ ...prev, raising: prev.raising === r.value ? "" : r.value }))}
                        className={chip(formData.raising === r.value)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-[15px] text-foreground">Sectors</legend>
                  <div className="flex flex-wrap gap-2 pt-3">
                    {SUGGESTED_TAGS.map((t) => (
                      <button key={t.value} type="button" aria-pressed={formData.tags.includes(t.value)} onClick={() => toggleTag(t.value)} className={chip(formData.tags.includes(t.value))}>
                        {t.label}
                      </button>
                    ))}
                    {customSectors.map((t) => (
                      <button key={t} type="button" aria-pressed onClick={() => toggleTag(t)} className={chip(true)} aria-label={`Remove ${t}`}>
                        {t} ×
                      </button>
                    ))}
                  </div>
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, () => { toggleTag(newTag); setNewTag("") })}
                    placeholder="Another sector? Type it and press Enter"
                    className={cn(field, "h-10 text-[15px]")}
                  />
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-[15px] text-foreground">Looking for</legend>
                  <div className="flex flex-wrap gap-2 pt-3">
                    {SUGGESTED_ROLES.map((r) => (
                      <button key={r.value} type="button" aria-pressed={formData.lookingFor.includes(r.value)} onClick={() => toggleRole(r.value)} className={chip(formData.lookingFor.includes(r.value))}>
                        {r.label}
                      </button>
                    ))}
                    {customRoles.map((r) => (
                      <button key={r} type="button" aria-pressed onClick={() => toggleRole(r)} className={chip(true)} aria-label={`Remove ${r}`}>
                        {r} ×
                      </button>
                    ))}
                  </div>
                  <input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, () => { toggleRole(newRole); setNewRole("") })}
                    placeholder="Another role? Type it and press Enter"
                    className={cn(field, "h-10 text-[15px]")}
                  />
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-[15px] text-foreground">Files</legend>
                  <p className="pt-2 text-sm text-muted-foreground">A deck, a demo video, a voice note or a one-pager. Not ZIP files.</p>
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-input px-4 text-[15px] text-foreground hover:border-muted-foreground">
                    Attach files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.ppt,.pptx,.key,.doc,.docx,.txt,.mp4,.mov,.webm,.mp3,.wav,.m4a,video/*,audio/*"
                      className="sr-only"
                      onChange={(e) => { addFiles(e.target.files); e.target.value = "" }}
                    />
                  </label>
                  {formData.attachments && formData.attachments.length > 0 && (
                    <ul className="divide-y divide-border">
                      {formData.attachments.map((file, idx) => (
                        <li key={`${file.name}-${idx}`} className="flex items-baseline justify-between gap-4 py-3">
                          <span className="min-w-0 truncate text-[15px]">{file.name}</span>
                          <span className="flex shrink-0 items-baseline gap-4 text-xs text-muted-foreground">
                            {file.size}
                            <button type="button" onClick={() => removeAttachment(idx)} className="hover:text-foreground cursor-pointer">
                              Remove
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>
              </div>
            )}

            {submitError && (
              <p role="alert" className="text-[15px] text-destructive">{submitError}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border px-8 py-5">
            <div>
              {isEditing && onDelete && (
                <button type="button" onClick={() => setShowDeleteDialog(true)} disabled={saving} className="text-[15px] text-destructive hover:opacity-80 cursor-pointer">
                  Delete idea
                </button>
              )}
            </div>
            <div className="flex items-center gap-5">
              <button type="button" onClick={() => handleSubmit(true)} disabled={!canSave} className="text-[15px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                Save as draft
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={!canSave}
                className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-foreground px-5 text-[15px] font-medium text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? "Saving…" : isEditing ? "Save changes" : "Post idea"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-sm rounded-2xl border-border bg-popover p-8 text-popover-foreground">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-xl font-medium">Delete this idea?</AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] text-muted-foreground">
              Its likes, comments and files go with it. Investors who committed are told, and their
              commitments are cancelled. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-3">
            {/* Explicit classes: the stock outline variant adds a grey fill and shadow in dark mode. */}
            <AlertDialogCancel className="h-10 rounded-full border-input bg-transparent px-5 text-[15px] font-normal shadow-none hover:bg-transparent hover:border-muted-foreground dark:bg-transparent dark:hover:bg-transparent">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-10 rounded-full bg-destructive px-5 text-[15px] text-black hover:bg-destructive hover:opacity-90">
              Delete idea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
