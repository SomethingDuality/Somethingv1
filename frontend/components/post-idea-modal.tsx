"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
import { Plus, X, Trash2, Lightbulb, Cpu, Rocket, Globe, Check, Paperclip, Film, Volume2, FileText, Presentation } from "lucide-react"
import { cn } from "@/lib/utils"

type Stage = "concept" | "prototype" | "mvp" | "launched"

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
  stage: Stage
  lookingFor: string[]
  tags: string[]
  isDraft: boolean
  attachments?: Attachment[]
}

interface Idea {
  id: string
  title: string
  description?: string
  desc?: string
  stage: Stage
  lookingFor?: string[]
  tags: string[]
  isDraft?: boolean
  attachments?: Attachment[]
}

interface PostIdeaModalProps {
  trigger?: React.ReactNode
  isOpen?: boolean
  onClose?: () => void
  onSubmit: (data: IdeaFormData) => void
  onDelete?: () => void
  editingIdea?: Idea | null
}

const STAGE_CARDS: { value: Stage; label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string; ringColor: string; bgActive: string; textColor: string }[] = [
  {
    value: "concept",
    label: "Concept",
    description: "Validate specs & draft theory",
    icon: Lightbulb,
    color: "border-blue-500/30 text-blue-400",
    ringColor: "focus-within:ring-blue-500/20 active:border-blue-500/50",
    bgActive: "bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]",
    textColor: "text-blue-400",
  },
  {
    value: "prototype",
    label: "Prototype",
    description: "Initial functional alpha build",
    icon: Cpu,
    color: "border-amber-500/30 text-amber-400",
    ringColor: "focus-within:ring-amber-500/20 active:border-amber-500/50",
    bgActive: "bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    textColor: "text-amber-400",
  },
  {
    value: "mvp",
    label: "MVP",
    description: "Core features live & usable",
    icon: Rocket,
    color: "border-pink-500/30 text-pink-400",
    ringColor: "focus-within:ring-pink-500/20 active:border-pink-500/50",
    bgActive: "bg-pink-500/10 border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.15)]",
    textColor: "text-pink-400",
  },
  {
    value: "launched",
    label: "Launched",
    description: "Production release deployed",
    icon: Globe,
    color: "border-emerald-500/30 text-emerald-400",
    ringColor: "focus-within:ring-emerald-500/20 active:border-emerald-500/50",
    bgActive: "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    textColor: "text-emerald-400",
  },
]

const SUGGESTED_ROLES = [
  "Co-founder",
  "CTO",
  "Frontend Developer",
  "Backend Developer",
  "Full-stack Developer",
  "UI/UX Designer",
  "Product Manager",
  "Marketing Lead",
  "ML Engineer",
  "Community Manager",
]

const SUGGESTED_TAGS = [
  "AI/ML",
  "Web3",
  "Blockchain",
  "DeFi",
  "FinTech",
  "HealthTech",
  "SaaS",
  "Mobile App",
  "Developer Tools",
  "Open Source",
]

export function PostIdeaModal({
  trigger,
  isOpen: controlledOpen,
  onClose,
  onSubmit,
  onDelete,
  editingIdea,
}: PostIdeaModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formData, setFormData] = useState<IdeaFormData>({
    title: "",
    description: "",
    stage: "concept",
    lookingFor: [],
    tags: [],
    isDraft: false,
    attachments: [],
  })
  const [newRole, setNewRole] = useState("")
  const [newTag, setNewTag] = useState("")

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const isEditing = !!editingIdea

  useEffect(() => {
    if (editingIdea) {
      setFormData({
        title: editingIdea.title || "",
        description: editingIdea.description || editingIdea.desc || "",
        stage: editingIdea.stage || "concept",
        lookingFor: editingIdea.lookingFor || [],
        tags: editingIdea.tags || [],
        isDraft: editingIdea.isDraft || false,
        attachments: editingIdea.attachments || [],
      })
    } else {
      setFormData({
        title: "",
        description: "",
        stage: "concept",
        lookingFor: [],
        tags: [],
        isDraft: false,
        attachments: [],
      })
    }
  }, [editingIdea, isOpen])

  const handleOpenChange = (open: boolean): void => {
    if (controlledOpen !== undefined) {
      if (!open && onClose) onClose()
    } else {
      setInternalOpen(open)
    }
  }

  const handleFileUpload = (
    type: "presentation" | "video" | "audio" | "document",
    files: FileList | null
  ) => {
    if (!files) return
    const fileList = Array.from(files)
    
    // Block ZIP files
    const hasZip = fileList.some(
      (file) =>
        file.name.toLowerCase().endsWith(".zip") ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed"
    )
    if (hasZip) {
      alert("ZIP files are not allowed for pitch materials.")
      return
    }

    const newAttachments = [...(formData.attachments || [])]

    fileList.forEach((file) => {
      let sizeStr = "0 KB"
      if (file.size > 1024 * 1024) {
        sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      } else if (file.size > 1024) {
        sizeStr = `${(file.size / 1024).toFixed(0)} KB`
      } else {
        sizeStr = `${file.size} B`
      }

      newAttachments.push({
        name: file.name,
        size: sizeStr,
        type,
        file, // keep the File object so the parent can upload it
      })
    })

    setFormData((prev) => ({
      ...prev,
      attachments: newAttachments,
    }))
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments?.filter((_, i) => i !== index) || [],
    }))
  }

  const handleSubmit = (isDraft: boolean): void => {
    if (!formData.title.trim() || !formData.description.trim()) return

    onSubmit({
      ...formData,
      isDraft,
    })

    // Reset form
    setFormData({
      title: "",
      description: "",
      stage: "concept",
      lookingFor: [],
      tags: [],
      isDraft: false,
      attachments: [],
    })

    handleOpenChange(false)
  }

  const handleDelete = (): void => {
    if (editingIdea && onDelete) {
      onDelete()
      setShowDeleteDialog(false)
      handleOpenChange(false)
    }
  }

  const toggleRole = (role: string): void => {
    const trimmed = role.trim()
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
    const trimmed = tag.trim()
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

  // Calculate completeness progress
  const getProgress = (): number => {
    let score = 0
    if (formData.title.trim().length >= 3) score += 30
    if (formData.description.trim().length >= 10) score += 30
    if (formData.stage) score += 20
    if (formData.lookingFor.length > 0) score += 10
    if (formData.tags.length > 0) score += 10
    return score
  }

  const progressPercent = getProgress()

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        {!trigger && controlledOpen === undefined && (
          <DialogTrigger asChild>
            <Button className="bg-white text-black hover:bg-[#34D399] rounded-full text-xs font-semibold px-5 transition-all">
              <Plus className="mr-1.5 h-4 w-4" />
              Post new idea
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="bg-popover/95 backdrop-blur-2xl border border-border/40 text-popover-foreground rounded-2xl sm:max-w-3xl shadow-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
          
          {/* Top Form Progress Bar */}
          <div className="w-full h-[3px] bg-foreground/[0.03]">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 via-[#34D399] to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Fixed Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/10 shrink-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-serif font-light text-foreground flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  {isEditing ? "Edit Project Idea" : "Post New Project Idea"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  {isEditing 
                    ? "Update your concept specifications and builder needs to matches updates."
                    : "Submit your concept details to recruit co-builders and get cohort feedback."
                  }
                </DialogDescription>
              </div>
              {isEditing && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-full h-8 w-8 shrink-0 mr-6"
                  title="Delete Idea"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-6 pr-4 space-y-6 max-h-[60vh] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
            
            {/* Title & Description Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Title Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="title" className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono">Title *</Label>
                  <span className="text-[11px] font-mono text-muted-foreground/50">{formData.title.length}/50</span>
                </div>
                <Input
                  id="title"
                  maxLength={50}
                  placeholder="Name your creation..."
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className={cn(
                    "bg-accent/20 border-border/40 text-foreground placeholder:text-foreground/30 rounded-lg text-xs h-9 transition-all duration-300",
                    formData.title.trim().length >= 3 
                      ? "focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/30 border-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.03)]" 
                      : "focus-visible:ring-foreground/10 focus-visible:border-border/20"
                  )}
                  required
                />
              </div>

              {/* Description Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="description" className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono">Description *</Label>
                  <span className="text-[11px] font-mono text-muted-foreground/50">{formData.description.length}/500</span>
                </div>
                <Textarea
                  id="description"
                  maxLength={500}
                  placeholder="Describe your idea, what problem it solves, and why builders should join..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className={cn(
                    "min-h-[80px] md:min-h-[90px] bg-accent/20 border-border/40 text-foreground placeholder:text-foreground/30 rounded-lg text-xs leading-relaxed transition-all duration-300",
                    formData.description.trim().length >= 10 
                      ? "focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/30 border-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.03)]" 
                      : "focus-visible:ring-foreground/10 focus-visible:border-border/20"
                  )}
                  required
                />
              </div>
            </div>

            {/* Current Stage Selection Grid */}
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono">Current Stage *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {STAGE_CARDS.map((option) => {
                  const selected = formData.stage === option.value
                  const CardIcon = option.icon
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setFormData((prev) => ({ ...prev, stage: option.value }))}
                      className={cn(
                        "flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-300 group cursor-pointer w-full",
                        selected
                          ? option.bgActive
                          : "bg-accent/10 border-border/40 hover:bg-accent/20 hover:border-border/60"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <div className={cn(
                          "p-2 rounded-lg bg-accent/30 border border-border/20 transition-all group-hover:scale-105",
                          selected ? option.textColor + " bg-accent/50" : "text-muted-foreground"
                        )}>
                          <CardIcon className="h-4 w-4" />
                        </div>
                        {selected && (
                          <div className={cn("p-0.5 rounded-full bg-accent/20 border border-border/40", option.textColor)}>
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "text-xs font-bold font-mono uppercase tracking-wider mt-2",
                        selected ? "text-foreground" : "text-foreground/80"
                      )}>
                        {option.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1 leading-snug font-sans">
                        {option.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Roles Needed and Tags Side-by-Side Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Roles Needed Section */}
              <div className="space-y-3">
                <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono block">Looking For (Roles Needed)</Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type custom role & press Add..."
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, () => {
                        if (newRole.trim()) {
                           toggleRole(newRole)
                           setNewRole("")
                        }
                      })}
                      className="bg-accent/20 border-border/40 text-foreground placeholder:text-foreground/30 rounded-lg text-xs h-9 flex-1 focus-visible:ring-foreground/10 focus-visible:border-border/25"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newRole.trim()) {
                          toggleRole(newRole)
                          setNewRole("")
                        }
                      }}
                      disabled={!newRole.trim()}
                      className="bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs font-semibold px-3.5 h-9 transition-colors shrink-0 cursor-pointer"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Horizontal Roles suggestions */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">Suggestions</span>
                    <div className="flex flex-nowrap gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5">
                      {SUGGESTED_ROLES.map((role) => {
                        const isSelected = formData.lookingFor.includes(role)
                        return (
                          <button
                            type="button"
                            key={role}
                            onClick={() => toggleRole(role)}
                            className={cn(
                              "h-6 px-2.5 rounded border transition-all font-mono text-[11px] shrink-0 cursor-pointer flex items-center gap-1",
                              isSelected 
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500 font-semibold"
                                : "border-border/40 bg-accent/10 hover:border-border/60 hover:bg-accent/30 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {isSelected ? <Check className="h-2.5 w-2.5" /> : "+"} {role}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Selected Roles container */}
                  {formData.lookingFor.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/10">
                      {formData.lookingFor.map((role) => (
                        <Badge key={role} className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[10px] font-mono py-0.5 px-2.5 rounded-full flex items-center gap-1.5">
                           {role}
                           <button
                             type="button"
                             onClick={() => toggleRole(role)}
                             className="h-3 w-3 rounded-full hover:bg-foreground/10 inline-flex items-center justify-center cursor-pointer"
                             aria-label={`Remove ${role}`}
                           >
                             <X className="h-2.5 w-2.5 text-indigo-500" />
                           </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-3">
                <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono block">Tags</Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type custom tag & press Add..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, () => {
                        if (newTag.trim()) {
                          toggleTag(newTag)
                          setNewTag("")
                        }
                      })}
                      className="bg-accent/20 border-border/40 text-foreground placeholder:text-foreground/30 rounded-lg text-xs h-9 flex-1 focus-visible:ring-foreground/10 focus-visible:border-border/25"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newTag.trim()) {
                          toggleTag(newTag)
                          setNewTag("")
                        }
                      }}
                      disabled={!newTag.trim()}
                      className="bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs font-semibold px-3.5 h-9 transition-colors shrink-0 cursor-pointer"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Horizontal Tags suggestions */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">Suggestions</span>
                    <div className="flex flex-nowrap gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5">
                      {SUGGESTED_TAGS.map((tag) => {
                        const isSelected = formData.tags.includes(tag)
                        return (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "h-6 px-2.5 rounded border transition-all font-mono text-[11px] shrink-0 cursor-pointer flex items-center gap-1",
                              isSelected 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 font-semibold"
                                : "border-border/40 bg-accent/10 hover:border-border/60 hover:bg-accent/30 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {isSelected ? <Check className="h-2.5 w-2.5" /> : "#"} {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Selected Tags container */}
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/10">
                      {formData.tags.map((tag) => (
                        <Badge key={tag} className="bg-accent text-foreground/80 border border-border/60 text-[10px] font-mono py-0.5 px-2.5 rounded-full flex items-center gap-1.5">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className="h-3 w-3 rounded-full hover:bg-foreground/10 inline-flex items-center justify-center cursor-pointer"
                            aria-label={`Remove ${tag}`}
                          >
                            <X className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pitch & Supporting Materials Section */}
            <div className="space-y-3 pt-4 border-t border-border/10">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-emerald-400" />
                <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono">Pitch Materials (No ZIP allowed)</Label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Presentation Deck */}
                <div className="relative border border-border/40 bg-accent/5 hover:bg-accent/10 rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all min-h-[90px]">
                  <input
                    type="file"
                    accept=".pdf,.ppt,.pptx"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload("presentation", e.target.files)}
                  />
                  <Presentation className="h-5 w-5 text-blue-400 mb-1.5" />
                  <span className="text-[10px] font-bold text-foreground">Pitch Deck</span>
                  <span className="text-[8px] text-muted-foreground mt-0.5 font-mono">PDF, PPT, PPTX</span>
                </div>

                {/* 2. Pitch Video */}
                <div className="relative border border-border/40 bg-accent/5 hover:bg-accent/10 rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all min-h-[90px]">
                  <input
                    type="file"
                    accept=".mp4,.mov,.webm,video/*"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload("video", e.target.files)}
                  />
                  <Film className="h-5 w-5 text-purple-400 mb-1.5" />
                  <span className="text-[10px] font-bold text-foreground">Pitch Video</span>
                  <span className="text-[8px] text-muted-foreground mt-0.5 font-mono">MP4, MOV, WEBM</span>
                </div>

                {/* 3. Audio Pitch */}
                <div className="relative border border-border/40 bg-accent/5 hover:bg-accent/10 rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all min-h-[90px]">
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/*"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload("audio", e.target.files)}
                  />
                  <Volume2 className="h-5 w-5 text-amber-400 mb-1.5" />
                  <span className="text-[10px] font-bold text-foreground">Audio Pitch</span>
                  <span className="text-[8px] text-muted-foreground mt-0.5 font-mono">MP3, WAV, M4A</span>
                </div>

                {/* 4. Supporting Document */}
                <div className="relative border border-border/40 bg-accent/5 hover:bg-accent/10 rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all min-h-[90px]">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload("document", e.target.files)}
                  />
                  <FileText className="h-5 w-5 text-rose-400 mb-1.5" />
                  <span className="text-[10px] font-bold text-foreground">One-Pager / Doc</span>
                  <span className="text-[8px] text-muted-foreground mt-0.5 font-mono">PDF, DOC, DOCX, TXT</span>
                </div>
              </div>

              {/* Uploaded Pitches list */}
              {formData.attachments && formData.attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">Uploaded Materials ({formData.attachments.length})</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formData.attachments.map((file, idx) => {
                      const AttachmentIcon = {
                        presentation: Presentation,
                        video: Film,
                        audio: Volume2,
                        document: FileText,
                      }[file.type] || Paperclip

                      const colorClass = {
                        presentation: "text-blue-400 border-blue-500/20 bg-blue-500/5",
                        video: "text-purple-400 border-purple-500/20 bg-purple-500/5",
                        audio: "text-amber-400 border-amber-500/20 bg-amber-500/5",
                        document: "text-rose-400 border-rose-500/20 bg-rose-500/5",
                      }[file.type] || "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"

                      return (
                        <div key={idx} className={cn("flex items-center justify-between border rounded-lg px-3 py-2 text-xs", colorClass)}>
                          <div className="flex items-center gap-2 min-w-0">
                            <AttachmentIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate font-mono text-[11px] font-medium">{file.name}</span>
                            <span className="text-[9px] opacity-60 font-mono">({file.size})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="p-1 rounded hover:bg-foreground/10 text-inherit cursor-pointer shrink-0"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Fixed Actions Footer */}
          <div className="flex gap-2.5 justify-end p-6 border-t border-border/10 bg-accent/10 shrink-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              className="border-border/40 text-foreground/75 hover:bg-accent/50 text-xs font-semibold rounded-lg h-9 px-4 bg-transparent cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={!formData.title.trim() || !formData.description.trim()}
              className="border-border/40 text-foreground/75 hover:bg-accent/50 text-xs font-semibold rounded-lg h-9 px-4 bg-transparent cursor-pointer"
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={!formData.title.trim() || !formData.description.trim()}
              className="bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold h-9 px-5 rounded-lg transition-all cursor-pointer"
            >
              {isEditing ? "Save Changes" : "Post Idea"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-popover border border-border/40 text-popover-foreground backdrop-blur-xl rounded-2xl p-6 shadow-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif font-light text-base">Delete Idea</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed mt-1">
              Are you sure you want to permanently delete this project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="border-border/40 text-foreground hover:bg-accent/40 rounded-lg text-xs h-8 px-3 cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs h-8 px-3 cursor-pointer">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}