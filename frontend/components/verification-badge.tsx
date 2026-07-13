"use client"

import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"

export function VerificationBadge({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-pointer select-none items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white hover:bg-white/[0.12]",
            className,
          )}
          aria-label="Verified by Something – tap for details"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-[#101113] text-white border-[#1a1b1e]">
        <DialogHeader>
          <DialogTitle>Verified by Something</DialogTitle>
          <DialogDescription className="text-white/60">
            This account passed our lightweight verification. We verified identity and recent activity signals.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 list-disc pl-5 text-sm text-white/80">
          <li>Identity and basic KYC</li>
          <li>Active portfolio or references</li>
          <li>Consistent communication history</li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
