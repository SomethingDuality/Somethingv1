"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import apiClient, { assetUrl } from "@/lib/axios"
import { apiError } from "@/lib/utils"
import { Aside, Main, Page, PageTitle, Section, Split, pillClass, quietLinkClass, relativeTime, usd } from "@/components/shell/page"
import { FounderCard, type FounderCardData } from "@/components/founder-card"
import { fileKind } from "@/lib/files"
import { IdeaCover } from "@/components/visual/idea-cover"
import { IdeaFacts } from "@/components/visual/idea-facts"
import { MoneyPanel } from "@/components/visual/money-panel"
import { IdeaUpdates } from "@/components/idea-updates"
import { IdeaMilestones, toMilestone, type Milestone } from "@/components/idea-milestones"
import { useAuth } from "@/components/auth-provider"
import { labelFor } from "@/lib/taxonomy"
import { toast } from "@/components/ui/use-toast"
import { SkeletonRows } from "@/components/visual/skeleton"



type Stage = "concept" | "prototype" | "mvp" | "launched"

export interface Attachment {
  name: string
  size: string
  type: "presentation" | "video" | "audio" | "document"
  url?: string
}

interface Idea {
  id: string
  founder_id?: string
  title: string
  author: string
  authorAvatar?: string
  authorHeadline?: string
  stage: Stage
  tags: string[]
  description: string
  lookingFor: string[]
  likes: number
  downvotes?: number
  commentsCount: number
  flagged?: boolean
  flagReason?: string
  attachments?: Attachment[]
  views?: number
  raising?: string
  milestones?: Milestone[]
  founder?: FounderCardData | null
  team?: { name: string; role: string; isFounder: boolean }[]
  commitments?: { count: number; total: number; released: number }
  createdAt?: string
}

interface Comment {
  id: string
  author: string
  authorAvatar?: string   // the API doesn't send avatars yet
  text: string
  timestamp: string
}

export default function IdeaDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [idea, setIdea] = useState<Idea | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Feedback states
  const { user } = useAuth()
  const [commentInput, setCommentInput] = useState("")
  

  const handleShareClick = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      toast({ title: "Link copied" })
    }
  }

  const [isCollaborating, setIsCollaborating] = useState(false)

  const handleCollaborate = async () => {
    if (!id) return
    setIsCollaborating(true)
    try {
      await apiClient.post(`/ideas/${id}/collaborate`)
      toast({ title: "Request sent", description: "The founder has been notified." })
    } catch (err) {
      toast({ title: "Request not sent", description: apiError(err, "Please try again."), variant: "destructive" })
    } finally {
      setIsCollaborating(false)
    }
  }


  // No fallback to the sample projects: if the idea can't be loaded, say so and offer Retry.
  const fetchData = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ideaData: any
    try {
      ideaData = (await apiClient.get(`/ideas/${id}`)).data
    } catch (err) {
      setError(apiError(err, "Couldn't load this idea."))
      setIsLoading(false)
      return
    }

    setIdea({
      ...ideaData,
      id: ideaData._id ?? ideaData.id,
      milestones: (ideaData.milestones ?? []).map(toMilestone),
      commentsCount: ideaData.comments ?? 0,
    })

    try {
      const commentsRes = await apiClient.get<{ success: boolean; comments: Comment[] }>(`/ideas/${id}/comments`)
      setComments(commentsRes.data?.comments ?? [])
    } catch {
      setComments([])
      toast({ title: "Couldn't load comments", description: "Try reloading the page.", variant: "destructive" })
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Server data lives on the server; this only updates what's on screen.
  const saveIdeaState = (updatedIdea: Idea) => setIdea(updatedIdea)

  const [liking, setLiking] = useState(false)
  const handleLike = async () => {
    if (!idea || liking) return
    setLiking(true)
    try {
      const res = await apiClient.post<{ likes: number }>(`/ideas/${id}/like`, {})
      saveIdeaState({ ...idea, likes: res.data.likes })
    } catch (err) {
      toast({ title: "Like not saved", description: apiError(err), variant: "destructive" })
    } finally {
      setLiking(false)
    }
  }

  const handleAddComment = async () => {
    if (!idea || !commentInput.trim()) return

    const commentText = commentInput.trim()
    setCommentInput("")

    try {
      const res = await apiClient.post<{ success: boolean; comment: Comment }>(`/ideas/${id}/comments`, { text: commentText })
      if (res.data?.success && res.data.comment) {
        const updatedComments = [...comments, res.data.comment]
        setComments(updatedComments)
        saveIdeaState({ ...idea, commentsCount: updatedComments.length })
      }
    } catch (err) {
      // No fake local comment: keep the text so the user can retry, and say what went wrong.
      setCommentInput(commentText)
      toast({ title: "Comment not posted", description: apiError(err, "Check your connection and try again."), variant: "destructive" })
    }
  }

  if (isLoading) {
    return <Page><SkeletonRows /></Page>
  }

  if (error || !idea) {
    return (
      <Page>
        <PageTitle title="Couldn't open this idea">{error || "It may have been deleted, or it's still a draft."}</PageTitle>
        <div className="mt-8 flex gap-5">
          <button type="button" onClick={() => router.back()} className={quietLinkClass}>Go back</button>
          {error && <button type="button" onClick={fetchData} className={quietLinkClass}>Retry</button>}
        </div>
      </Page>
    )
  }

  const isOwner = Boolean(user?.id && String(idea.founder_id) === String(user.id))

  return (
    <Page>
      <Link href="/founder/ideas" className={quietLinkClass}>Back to ideas</Link>

      {/* The cover, then: the idea, updates, milestones and comments on the left; money, people and files on the right (xl). */}
      <IdeaCover id={idea.id} sectors={idea.tags} className="mt-6 aspect-[21/9] w-full sm:aspect-[32/9]" rounded="rounded-3xl" />

      <Split className="mt-10">
        <Main>
          <div>
            <PageTitle title={idea.title} />
            <div className="mt-5">
              <IdeaFacts
                founder={isOwner ? "You" : idea.founder?.name || idea.author}
                founderAvatar={idea.founder?.avatarUrl}
                stage={idea.stage}
                raising={idea.raising}
                location={idea.founder?.location}
                sectors={idea.tags}
                postedAt={idea.createdAt}
                views={idea.views ?? 0}
                likes={idea.likes}
                comments={idea.commentsCount}
              />
            </div>
            <p className="mt-8 max-w-[62ch] whitespace-pre-line text-lg leading-relaxed text-foreground/90">{idea.description}</p>
            {idea.lookingFor && idea.lookingFor.length > 0 && (
              <p className="mt-6 text-[15px] text-muted-foreground">
                Looking for <span className="text-foreground">{idea.lookingFor.map((r) => labelFor("roles", r)).join(", ")}</span>
              </p>
            )}
          </div>
        </Main>

        <Aside>
          {isOwner ? (
            <MoneyPanel
              className="mt-10 xl:mt-0"
              rows={[
                { label: "Committed by investors", value: usd(idea.commitments?.total ?? 0), tone: "gold" },
                { label: "Released", value: usd(idea.commitments?.released ?? 0), tone: (idea.commitments?.released ?? 0) > 0 ? "done" : "plain" },
                { label: (idea.commitments?.count ?? 0) === 1 ? "Investor" : "Investors", value: String(idea.commitments?.count ?? 0) },
                { label: "Views", value: String(idea.views ?? 0) },
              ]}
              note="No money moves on Something yet: commitments and releases are records. Mark milestones done so investors can release against them."
            >
              <button type="button" onClick={handleShareClick} className={quietLinkClass}>Copy link</button>
            </MoneyPanel>
          ) : (
            <div className="mt-10 flex flex-wrap items-center gap-5 xl:mt-0">
              <button type="button" onClick={handleCollaborate} disabled={isCollaborating} className={pillClass}>
                {isCollaborating ? "Sending…" : "Ask to join"}
              </button>
              <button type="button" onClick={handleLike} disabled={liking} className={quietLinkClass}>Like</button>
              <button type="button" onClick={handleShareClick} className={quietLinkClass}>Copy link</button>
            </div>
          )}

          {!isOwner && idea.founder && (
            <Section title="Founder">
              <FounderCard founder={idea.founder} />
            </Section>
          )}

          {(idea.team ?? []).some((m) => !m.isFounder) && (
            <Section title="Team">
              <ul className="divide-y divide-border">
                {idea.team!.map((m, i) => (
                  <li key={`${m.name}-${i}`} className="flex items-baseline justify-between gap-6 py-3">
                    <span className="text-[15px]">{m.isFounder && isOwner ? "You" : m.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{m.isFounder ? "Founder" : m.role}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {idea.attachments && idea.attachments.length > 0 && (
            <Section title="Files">
              <ul className="divide-y divide-border border-y border-border">
                {idea.attachments.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-baseline justify-between gap-6 py-4">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">{f.name}</span>
                      <span className="block text-xs text-muted-foreground">{[fileKind(f.type), f.size].filter(Boolean).join(", ")}</span>
                    </span>
                    {f.url ? (
                      <a href={assetUrl(f.url)} target="_blank" rel="noopener noreferrer" className={quietLinkClass}>Open</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not uploaded</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

        </Aside>

        <Main>
          <IdeaUpdates ideaId={idea.id} isOwner={isOwner} />

          <IdeaMilestones
            ideaId={idea.id}
            milestones={idea.milestones ?? []}
            isOwner={isOwner}
            onChange={(next) => setIdea((cur) => (cur ? { ...cur, milestones: next } : cur))}
          />

          <Section title={`Comments${comments.length ? ` (${comments.length})` : ""}`}>
            <form onSubmit={(e) => { e.preventDefault(); handleAddComment() }} className="flex flex-col gap-3 sm:flex-row">
              <input
                aria-label="Write a comment"
                placeholder="Ask a question or share a thought"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-full border border-input bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
              />
              <button type="submit" disabled={!commentInput.trim()} className={pillClass}>Post</button>
            </form>
            {comments.length === 0 ? (
              <p className="mt-6 text-[15px] text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="mt-6 divide-y divide-border">
                {comments.map((c) => (
                  <li key={c.id} className="py-5">
                    <div className="flex items-baseline justify-between gap-6">
                      <span className="text-[15px] text-foreground">{c.author || "Someone"}</span>
                      <span className="text-xs text-muted-foreground">{relativeTime(c.timestamp)}</span>
                    </div>
                    <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-foreground/90">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

        </Main>
      </Split>
    </Page>
  )
}
