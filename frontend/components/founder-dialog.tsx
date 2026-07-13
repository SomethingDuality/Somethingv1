"use client"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type Founder = {
  id: string
  name: string
  role: string
  bio?: string
  tags?: string[]
  links?: { label: string; href: string }[]
}

export function FounderDialog({ founder, className }: { founder: Founder; className?: string }) {
  const initials = founder.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-3 rounded-md border border-white/10 bg-[#0f1012] px-3 py-2 text-sm hover:bg-white/[0.04]",
            className,
          )}
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#101113] text-xs font-medium ring-1 ring-white/10">
            {initials}
          </span>
          <span className="text-left">
            <span className="block font-medium">{founder.name}</span>
            <span className="block text-[11px] text-white/60">{founder.role}</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-[#101113] text-white border-[#1a1b1e]">
        <DialogHeader>
          <DialogTitle>{founder.name}</DialogTitle>
          <DialogDescription className="text-white/60">{founder.role}</DialogDescription>
        </DialogHeader>
        {founder.bio && <p className="text-sm text-white/80">{founder.bio}</p>}
        {founder.tags && founder.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {founder.tags.map((t) => (
              <Badge key={t} variant="secondary" className="bg-white/[0.04] text-white border-white/10">
                {t}
              </Badge>
            ))}
          </div>
        )}
        {founder.links && founder.links.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {founder.links.map((l, i) => (
              <a
                key={i}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#0f1012] px-2 py-1 text-xs hover:bg-white/[0.04]"
              >
                <Link2 className="h-3.5 w-3.5" />
                {l.label}
              </a>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
