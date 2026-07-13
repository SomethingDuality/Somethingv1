"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Plus,
  X,
  FileText,
  ImageIcon,
  Video,
  Presentation,
  DollarSign,
  Calendar,
  Target,
  Lightbulb,
  Trash2,
} from "lucide-react"

type CampaignStage = "concept" | "prototype" | "mvp" | "launched"
type FundingType = "milestone" | "equity" | "revenue-share" | "grant"

interface NewCampaignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateCampaign: (campaign: Record<string, unknown>) => void
}

export function NewCampaignModal({ open, onOpenChange, onCreateCampaign }: NewCampaignModalProps) {
  const [formData, setFormData] = useState({
    ideaName: "",
    tagline: "",
    description: "",
    stage: "" as CampaignStage,
    fundingType: "" as FundingType,
    fundingGoal: "",
    duration: "",
    useOfFunds: "",
    tags: [] as string[],
    milestones: [{ title: "", amount: "", description: "", timeline: "" }],
    uploads: {
      presentation: null as File | null,
      video: null as File | null,
      images: [] as File[],
      documents: [] as File[],
    },
  })

  const [newTag, setNewTag] = useState("")

  const stageOptions = [
    { value: "concept", label: "Concept" },
    { value: "prototype", label: "Prototype" },
    { value: "mvp", label: "MVP" },
    { value: "launched", label: "Launched" },
  ]

  const fundingTypeOptions = [
    { value: "milestone", label: "Milestone-based" },
    { value: "equity", label: "Equity" },
    { value: "revenue-share", label: "Revenue Share" },
    { value: "grant", label: "Grant" },
  ]

  const suggestedTags = [
    "AI/ML",
    "Blockchain",
    "SaaS",
    "Hardware",
    "Mobile",
    "Web3",
    "FinTech",
    "HealthTech",
    "EdTech",
    "ClimaTech",
    "IoT",
    "AR/VR",
  ]

  const handleAddTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] })
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) })
  }

  const addMilestone = () => {
    setFormData({
      ...formData,
      milestones: [...formData.milestones, { title: "", amount: "", description: "", timeline: "" }],
    })
  }

  const updateMilestone = (index: number, field: string, value: string) => {
    const updated = [...formData.milestones]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, milestones: updated })
  }

  const removeMilestone = (index: number) => {
    if (formData.milestones.length > 1) {
      setFormData({ ...formData, milestones: formData.milestones.filter((_, i) => i !== index) })
    }
  }

  const handleFileUpload = (type: string, files: FileList | null) => {
    if (!files) return

    const newUploads = { ...formData.uploads }

    if (type === "presentation" || type === "video") {
      (newUploads as Record<string, unknown>)[type] = files[0]
    } else {
      const currentFiles = newUploads[type as keyof typeof newUploads] as File[]
      ;(newUploads as Record<string, unknown>)[type] = [...currentFiles, ...Array.from(files)]
    }

    setFormData({ ...formData, uploads: newUploads })
  }

  const removeFile = (type: string, index?: number) => {
    const newUploads = { ...formData.uploads }

    if (type === "presentation" || type === "video") {
      ;(newUploads as Record<string, unknown>)[type] = null
    } else {
      const currentFiles = newUploads[type as keyof typeof newUploads] as File[]
      if (index !== undefined) {
        ;(newUploads as Record<string, unknown>)[type] = currentFiles.filter((_, i) => i !== index)
      }
    }

    setFormData({ ...formData, uploads: newUploads })
  }

  const handleSubmit = (isDraft: boolean) => {
    const campaign = {
      ...formData,
      status: isDraft ? "draft" : "active",
      createdAt: new Date().toISOString(),
    }
    onCreateCampaign(campaign)
    onOpenChange(false)
    // Reset form
    setFormData({
      ideaName: "",
      tagline: "",
      description: "",
      stage: "" as CampaignStage,
      fundingType: "" as FundingType,
      fundingGoal: "",
      duration: "",
      useOfFunds: "",
      tags: [],
      milestones: [{ title: "", amount: "", description: "", timeline: "" }],
      uploads: {
        presentation: null,
        video: null,
        images: [],
        documents: [],
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101113] border-[#1a1b1e] max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lightbulb className="h-5 w-5" />
            Create New Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1a1b1e]">
              <Target className="h-4 w-4" />
              <h3 className="font-medium">Basic Information</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ideaName">Project Name *</Label>
                <Input
                  id="ideaName"
                  value={formData.ideaName}
                  onChange={(e) => setFormData({ ...formData, ideaName: e.target.value })}
                  className="bg-[#0f1012] border-[#1a1b1e]"
                  placeholder="Enter your project name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="bg-[#0f1012] border-[#1a1b1e]"
                  placeholder="One-line description"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#0f1012] border-[#1a1b1e] min-h-[100px]"
                placeholder="Describe your project, problem it solves, and your vision..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Stage *</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, stage: value as CampaignStage })}>
                  <SelectTrigger className="bg-[#0f1012] border-[#1a1b1e]">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#101113] border-[#1a1b1e]">
                    {stageOptions.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campaign Duration</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, duration: value })}>
                  <SelectTrigger className="bg-[#0f1012] border-[#1a1b1e]">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#101113] border-[#1a1b1e]">
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="120">120 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Funding Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1a1b1e]">
              <DollarSign className="h-4 w-4" />
              <h3 className="font-medium">Funding Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Funding Type *</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, fundingType: value as FundingType })}>
                  <SelectTrigger className="bg-[#0f1012] border-[#1a1b1e]">
                    <SelectValue placeholder="Select funding type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#101113] border-[#1a1b1e]">
                    {fundingTypeOptions.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fundingGoal">Funding Goal ($) *</Label>
                <Input
                  id="fundingGoal"
                  type="number"
                  value={formData.fundingGoal}
                  onChange={(e) => setFormData({ ...formData, fundingGoal: e.target.value })}
                  className="bg-[#0f1012] border-[#1a1b1e]"
                  placeholder="25000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="useOfFunds">Use of Funds</Label>
              <Textarea
                id="useOfFunds"
                value={formData.useOfFunds}
                onChange={(e) => setFormData({ ...formData, useOfFunds: e.target.value })}
                className="bg-[#0f1012] border-[#1a1b1e] min-h-[80px]"
                placeholder="Explain how you'll use the funding (development, marketing, hiring, etc.)"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1a1b1e]">
              <h3 className="font-medium">Tags</h3>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {suggestedTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddTag(tag)}
                    className="h-8 text-xs border-[#1a1b1e] hover:bg-white/5"
                    disabled={formData.tags.includes(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag(newTag)
                    }
                  }}
                  className="bg-[#0f1012] border-[#1a1b1e]"
                  placeholder="Add custom tag..."
                />
                <Button
                  type="button"
                  onClick={() => handleAddTag(newTag)}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Add
                </Button>
              </div>

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-blue-500/10 text-blue-300 border-blue-500/20 pr-1"
                    >
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-blue-200">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Milestones */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1a1b1e]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <h3 className="font-medium">Milestones</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
                className="border-[#1a1b1e] hover:bg-white/5 bg-transparent"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add milestone
              </Button>
            </div>

            <div className="space-y-4">
              {formData.milestones.map((milestone, index) => (
                <div key={index} className="p-4 rounded-lg border border-[#1a1b1e] bg-[#0f1012] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">Milestone {index + 1}</span>
                    {formData.milestones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMilestone(index)}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Milestone title"
                      value={milestone.title}
                      onChange={(e) => updateMilestone(index, "title", e.target.value)}
                      className="bg-[#101113] border-[#1a1b1e]"
                    />
                    <Input
                      type="number"
                      placeholder="Amount ($)"
                      value={milestone.amount}
                      onChange={(e) => updateMilestone(index, "amount", e.target.value)}
                      className="bg-[#101113] border-[#1a1b1e]"
                    />
                  </div>
                  <Textarea
                    placeholder="Milestone description and deliverables"
                    value={milestone.description}
                    onChange={(e) => updateMilestone(index, "description", e.target.value)}
                    className="bg-[#101113] border-[#1a1b1e] min-h-[60px]"
                  />
                  <Input
                    placeholder="Timeline (e.g., 2 weeks, 1 month)"
                    value={milestone.timeline}
                    onChange={(e) => updateMilestone(index, "timeline", e.target.value)}
                    className="bg-[#101113] border-[#1a1b1e]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* File Uploads */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1a1b1e]">
              <Upload className="h-4 w-4" />
              <h3 className="font-medium">Media & Documents</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Presentation Upload */}
              <div className="space-y-2">
                <Label>Pitch Presentation</Label>
                <div className="border-2 border-dashed border-[#1a1b1e] rounded-lg p-4 text-center">
                  {formData.uploads.presentation ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Presentation className="h-4 w-4 text-blue-400" />
                        <span className="text-sm truncate">{formData.uploads.presentation.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile("presentation")}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Presentation className="h-8 w-8 mx-auto mb-2 text-white/40" />
                      <p className="text-sm text-white/60 mb-2">Upload pitch deck</p>
                      <input
                        type="file"
                        accept=".pdf,.ppt,.pptx"
                        onChange={(e) => handleFileUpload("presentation", e.target.files)}
                        className="hidden"
                        id="presentation-upload"
                      />
                      <Label
                        htmlFor="presentation-upload"
                        className="cursor-pointer inline-flex items-center px-3 py-1.5 text-xs border border-[#1a1b1e] rounded-md hover:bg-white/5"
                      >
                        Choose file
                      </Label>
                    </>
                  )}
                </div>
              </div>

              {/* Video Upload */}
              <div className="space-y-2">
                <Label>Pitch Video</Label>
                <div className="border-2 border-dashed border-[#1a1b1e] rounded-lg p-4 text-center">
                  {formData.uploads.video ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-purple-400" />
                        <span className="text-sm truncate">{formData.uploads.video.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile("video")}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Video className="h-8 w-8 mx-auto mb-2 text-white/40" />
                      <p className="text-sm text-white/60 mb-2">Upload pitch video</p>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleFileUpload("video", e.target.files)}
                        className="hidden"
                        id="video-upload"
                      />
                      <Label
                        htmlFor="video-upload"
                        className="cursor-pointer inline-flex items-center px-3 py-1.5 text-xs border border-[#1a1b1e] rounded-md hover:bg-white/5"
                      >
                        Choose file
                      </Label>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Images Upload */}
              <div className="space-y-2">
                <Label>Images & Screenshots</Label>
                <div className="border-2 border-dashed border-[#1a1b1e] rounded-lg p-4">
                  {formData.uploads.images.length > 0 ? (
                    <div className="space-y-2">
                      {formData.uploads.images.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-3 w-3 text-green-400" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile("images", index)}
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileUpload("images", e.target.files)}
                        className="hidden"
                        id="images-upload"
                      />
                      <Label
                        htmlFor="images-upload"
                        className="cursor-pointer inline-flex items-center px-2 py-1 text-xs border border-[#1a1b1e] rounded hover:bg-white/5"
                      >
                        Add more
                      </Label>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="h-6 w-6 mx-auto mb-2 text-white/40" />
                      <p className="text-xs text-white/60 mb-2">Product images</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileUpload("images", e.target.files)}
                        className="hidden"
                        id="images-upload"
                      />
                      <Label
                        htmlFor="images-upload"
                        className="cursor-pointer inline-flex items-center px-3 py-1.5 text-xs border border-[#1a1b1e] rounded-md hover:bg-white/5"
                      >
                        Choose files
                      </Label>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents Upload */}
              <div className="space-y-2">
                <Label>Supporting Documents</Label>
                <div className="border-2 border-dashed border-[#1a1b1e] rounded-lg p-4">
                  {formData.uploads.documents.length > 0 ? (
                    <div className="space-y-2">
                      {formData.uploads.documents.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-orange-400" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile("documents", index)}
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        multiple
                        onChange={(e) => handleFileUpload("documents", e.target.files)}
                        className="hidden"
                        id="documents-upload"
                      />
                      <Label
                        htmlFor="documents-upload"
                        className="cursor-pointer inline-flex items-center px-2 py-1 text-xs border border-[#1a1b1e] rounded hover:bg-white/5"
                      >
                        Add more
                      </Label>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileText className="h-6 w-6 mx-auto mb-2 text-white/40" />
                      <p className="text-xs text-white/60 mb-2">Business docs</p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        multiple
                        onChange={(e) => handleFileUpload("documents", e.target.files)}
                        className="hidden"
                        id="documents-upload"
                      />
                      <Label
                        htmlFor="documents-upload"
                        className="cursor-pointer inline-flex items-center px-3 py-1.5 text-xs border border-[#1a1b1e] rounded-md hover:bg-white/5"
                      >
                        Choose files
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-[#1a1b1e]">
            <Button
              onClick={() => handleSubmit(false)}
              disabled={!formData.ideaName || !formData.description || !formData.fundingGoal}
              className="bg-white text-black hover:bg-white/90"
            >
              Create Campaign
            </Button>
            <Button onClick={() => handleSubmit(true)} variant="outline" className="border-[#1a1b1e] hover:bg-white/5">
              Save as Draft
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#1a1b1e] hover:bg-white/5">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
