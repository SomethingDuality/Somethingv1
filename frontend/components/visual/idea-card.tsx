import Link from "next/link"
import { cn } from "@/lib/utils"
import { labelFor } from "@/lib/taxonomy"
import { when } from "@/lib/format"
import { ideaPalettes } from "@/lib/visual"
import { IdeaCover } from "@/components/visual/idea-cover"
import { Avatar } from "@/components/visual/avatar"

export type IdeaCardData = {
  id: string
  title: string
  description?: string
  sectors: string[]
  stage?: string
  raising?: string
  author?: string
  authorAvatar?: string | null
  location?: string
  likes?: number
  comments?: number
  createdAt?: string | null
  milestones?: { status: "open" | "done" }[]
  isDraft?: boolean
}

/** The raising band; gold when the founder is raising (money), muted when they aren't. */
export function RaisingLabel({ raising, className }: { raising: string; className?: string }) {
  return (
    <span className={cn(raising === "not_raising" ? "text-muted-foreground" : "text-gold", className)}>
      {raising === "not_raising" ? "Not raising" : `Raising ${labelFor("raisingBands", raising)}`}
    </span>
  )
}

/** Sector names, each with its colour dot (the same colour as the cover). */
export function SectorList({ sectors, className }: { sectors: string[]; className?: string }) {
  if (!sectors.length) return null
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {sectors.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: ideaPalettes([s])[0][1] }} />
          {labelFor("sectors", s)}
        </span>
      ))}
    </span>
  )
}

/** "3 of 5 milestones" with a segmented bar; nothing when the idea has none. */
export function MilestoneMeter({ milestones, className }: { milestones?: { status: "open" | "done" }[]; className?: string }) {
  if (!milestones?.length) return null
  const done = milestones.filter((m) => m.status === "done").length
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex gap-0.5">
        {milestones.map((m, i) => (
          <span key={i} className={cn("h-1.5 w-3 rounded-full", m.status === "done" ? "bg-done" : "bg-line")} />
        ))}
      </span>
      {done} of {milestones.length} milestones
    </span>
  )
}

/**
 * An idea as an object: its cover, title, the first lines of the pitch, who posted it and the
 * facts an investor scans for (stage, raising, sectors, milestones). `action` sits by the title
 * (Save, Edit, Like…).
 */
export function IdeaCard({ idea, href, action, className }: { idea: IdeaCardData; href: string; action?: React.ReactNode; className?: string }) {
  return (
    <article className={cn("group flex min-w-0 flex-col", className)}>
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <IdeaCover id={idea.id} sectors={idea.sectors} className="aspect-[16/10] w-full transition-opacity duration-200 group-hover:opacity-90" />
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <Link href={href} className="min-w-0 text-lg leading-snug text-foreground underline-offset-4 hover:underline">
          {idea.title}
        </Link>
        {action && <span className="shrink-0 pt-0.5">{action}</span>}
      </div>
      {idea.description && (
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">{idea.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {idea.isDraft && <span className="rounded-full border border-line px-2 py-0.5 text-foreground">Draft</span>}
        {idea.author && (
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={idea.author} src={idea.authorAvatar} size={18} />
            {idea.author}
          </span>
        )}
        <span>{idea.stage ? labelFor("ideaStages", idea.stage) : "No stage yet"}</span>
        {idea.raising && <RaisingLabel raising={idea.raising} />}
        {idea.location && <span>{idea.location}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <SectorList sectors={idea.sectors} />
        <MilestoneMeter milestones={idea.milestones} />
        {idea.createdAt && <span>{when(idea.createdAt)}</span>}
      </div>
    </article>
  )
}
