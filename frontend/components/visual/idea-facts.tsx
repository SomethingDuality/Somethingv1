import { labelFor } from "@/lib/taxonomy"
import { dateLabel } from "@/lib/format"
import { countOf } from "@/components/shell/page"
import { Avatar } from "@/components/visual/avatar"
import { RaisingLabel, SectorList } from "@/components/visual/idea-card"

/** The facts line under an idea's title: who, stage, raising, where, sectors, when, attention. */
export function IdeaFacts({
  founder,
  founderAvatar,
  stage,
  raising,
  location,
  sectors,
  postedAt,
  views,
  likes,
  comments,
}: {
  founder?: string
  founderAvatar?: string | null
  stage?: string
  raising?: string
  location?: string
  sectors: string[]
  postedAt?: string | null
  views?: number
  likes?: number
  comments?: number
}) {
  return (
    <div className="space-y-2.5 text-sm text-muted-foreground">
      <p className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {founder && (
          <span className="inline-flex items-center gap-2 text-foreground">
            <Avatar name={founder} src={founderAvatar} size={24} />
            {founder}
          </span>
        )}
        <span>{stage ? labelFor("ideaStages", stage) : "No stage yet"}</span>
        {raising && <RaisingLabel raising={raising} />}
        {location && <span>{location}</span>}
        {postedAt && <span>Posted {dateLabel(postedAt)}</span>}
      </p>
      <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <SectorList sectors={sectors} />
        {views !== undefined && <span>{countOf(views, "view")}</span>}
        {likes !== undefined && <span>{countOf(likes, "supporter")}</span>}
        {comments !== undefined && <span>{countOf(comments, "comment")}</span>}
      </p>
    </div>
  )
}
