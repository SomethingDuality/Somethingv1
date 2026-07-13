"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, FileText, ImageIcon, Receipt, DollarSign } from "lucide-react"

interface FundUsageEntry {
  category: string
  amount: string
  description: string
  date: string
  vendor: string
  receipts: File[]
  proofImages: File[]
  notes: string
}

interface FundUsageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign?: Record<string, unknown>
  onAddUsage: (usage: FundUsageEntry & { id: number; createdAt: string; status: string }) => void
}

export function FundUsageModal({ open, onOpenChange, onAddUsage }: FundUsageModalProps) {
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    description: "",
    date: "",
    vendor: "",
    receipts: [] as File[],
    proofImages: [] as File[],
    notes: "",
  })

  const categories = [
    "Development",
    "Marketing",
    "Legal",
    "Equipment",
    "Software/Tools",
    "Hiring",
    "Operations",
    "Research",
    "Other",
  ]

  const handleFileUpload = (type: string, files: FileList | null) => {
    if (!files) return

    const newFormData = { ...formData }
    const currentFiles = newFormData[type as keyof typeof formData] as File[]
    ;(newFormData as Record<string, unknown>)[type] = [...currentFiles, ...Array.from(files)]

    setFormData(newFormData)
  }

  const removeFile = (type: string, index: number) => {
    const newFormData = { ...formData }
    const currentFiles = newFormData[type as keyof typeof formData] as File[]
    ;(newFormData as Record<string, unknown>)[type] = currentFiles.filter((_, i) => i !== index)
    setFormData(newFormData)
  }

  const handleSubmit = () => {
    const usage = {
      id: Date.now(),
      ...formData,
      amount: Number.parseFloat(formData.amount),
      createdAt: new Date().toISOString(),
      status: "pending", // pending, approved, rejected
    }
    onAddUsage(usage)
    onOpenChange(false)
    // Reset form
    setFormData({
      category: "",
      amount: "",
      description: "",
      date: "",
      vendor: "",
      receipts: [],
      proofImages: [],
      notes: "",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101113] border-[#1a1b1e] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5" />
            Report Fund Usage
          </DialogTitle>
          <p className="text-sm text-white/60">Show the community how you&apos;re using the funds with receipts and proof</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1a1b1e]">
              <DollarSign className="h-4 w-4" />
              <h3 className="font-medium">Expense Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger className="bg-[#0f1012] border-[#1a1b1e]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#101113] border-[#1a1b1e]">
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="bg-[#0f1012] border-[#1a1b1e]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#0f1012] border-[#1a1b1e] min-h-[80px]"
                placeholder="What was this expense for? Be specific..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-[#0f1012] border-[#1a1b1e]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor/Company</Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="bg-[#0f1012] border-[#1a1b1e]"
                  placeholder="Who did you pay?"
                />
              </div>
            </div>
          </div>

          {/* Proof & Documentation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1a1b1e]">
              <FileText className="h-4 w-4" />
              <h3 className="font-medium">Proof & Documentation</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Receipts Upload */}
              <div className="space-y-2">
                <Label>Receipts *</Label>
                <div className="border-2 border-dashed border-[#1a1b1e] rounded-lg p-4">
                  {formData.receipts.length > 0 ? (
                    <div className="space-y-2">
                      {formData.receipts.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-3 w-3 text-green-400" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile("receipts", index)}
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        onChange={(e) => handleFileUpload("receipts", e.target.files)}
                        className="hidden"
                        id="receipts-upload"
                      />
                      <Label
                        htmlFor="receipts-upload"
                        className="cursor-pointer inline-flex items-center px-2 py-1 text-xs border border-[#1a1b1e] rounded hover:bg-white/5"
                      >
                        Add more
                      </Label>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Receipt className="h-6 w-6 mx-auto mb-2 text-white/40" />
                      <p className="text-xs text-white/60 mb-2">Upload receipts</p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        onChange={(e) => handleFileUpload("receipts", e.target.files)}
                        className="hidden"
                        id="receipts-upload"
                      />
                      <Label
                        htmlFor="receipts-upload"
                        className="cursor-pointer inline-flex items-center px-3 py-1.5 text-xs border border-[#1a1b1e] rounded-md hover:bg-white/5"
                      >
                        Choose files
                      </Label>
                    </div>
                  )}
                </div>
              </div>

              {/* Proof Images Upload */}
              <div className="space-y-2">
                <Label>Proof Images</Label>
                <div className="border-2 border-dashed border-[#1a1b1e] rounded-lg p-4">
                  {formData.proofImages.length > 0 ? (
                    <div className="space-y-2">
                      {formData.proofImages.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-3 w-3 text-blue-400" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile("proofImages", index)}
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
                        onChange={(e) => handleFileUpload("proofImages", e.target.files)}
                        className="hidden"
                        id="proof-upload"
                      />
                      <Label
                        htmlFor="proof-upload"
                        className="cursor-pointer inline-flex items-center px-2 py-1 text-xs border border-[#1a1b1e] rounded hover:bg-white/5"
                      >
                        Add more
                      </Label>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="h-6 w-6 mx-auto mb-2 text-white/40" />
                      <p className="text-xs text-white/60 mb-2">Screenshots, photos</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileUpload("proofImages", e.target.files)}
                        className="hidden"
                        id="proof-upload"
                      />
                      <Label
                        htmlFor="proof-upload"
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

          {/* Additional Notes */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-[#0f1012] border-[#1a1b1e] min-h-[60px]"
                placeholder="Any additional context or explanation..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-[#1a1b1e]">
            <Button
              onClick={handleSubmit}
              disabled={!formData.category || !formData.amount || !formData.description || !formData.date}
              className="bg-white text-black hover:bg-white/90"
            >
              Submit Usage Report
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
