"use client"

import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar } from "@/components/visual/avatar"
import { quietLinkClass } from "@/components/shell/page"

/** The public part of a founder, as the API sends it with an idea or a portfolio row. */
export type FounderCardData = {
  id?: string
  name: string
  headline?: string
  location?: string
  avatarUrl?: string
  links?: { linkedin?: string; github?: string; website?: string; twitter?: string }
}

const LINK_LABELS: [keyof NonNullable<FounderCardData["links"]>, string][] = [
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
  ["website", "Website"],
  ["twitter", "X"],
]

const href = (key: string, v: string) =>
  key === "twitter" && !/^https?:\/\//.test(v) ? `https://x.com/${v.replace(/^@/, "")}` : v

/** Name, headline, location and links. Nothing private: no email, no contact details. */
export function FounderCard({ founder }: { founder: FounderCardData }) {
  const links = LINK_LABELS.filter(([k]) => founder.links?.[k])
  return (
    <div className="flex items-start gap-4">
      <Avatar name={founder.name} src={founder.avatarUrl} size={44} />
      <div className="min-w-0">
        <p className="text-[15px] text-foreground">{founder.name}</p>
        {(founder.headline || founder.location) && (
          <p className="mt-0.5 text-sm text-muted-foreground">{[founder.headline, founder.location].filter(Boolean).join(", ")}</p>
        )}
        {links.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {links.map(([k, label]) => (
              <a key={k} href={href(k, founder.links![k]!)} target="_blank" rel="noopener noreferrer" className={`${quietLinkClass} text-sm`}>
                {label}
              </a>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}

/** The founder's name as a quiet button that opens their card. */
export function FounderCardButton({ founder }: { founder: FounderCardData }) {
  return (
    <Dialog>
      <DialogTrigger className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-pointer">
        {founder.name}
      </DialogTrigger>
      <DialogContent className="w-full max-w-md rounded-2xl border-border bg-popover p-8 text-popover-foreground">
        <DialogTitle className="sr-only">{founder.name}</DialogTitle>
        <DialogDescription className="sr-only">About the founder</DialogDescription>
        <FounderCard founder={founder} />
      </DialogContent>
    </Dialog>
  )
}
