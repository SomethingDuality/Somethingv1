"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { apiError, cn } from "@/lib/utils"
import { clearIdeaDraft, readIdeaDraft } from "@/lib/idea-draft"
import { toast } from "@/components/ui/use-toast"
import { labelFor } from "@/lib/taxonomy"
import { useSomethingBox } from "@/components/something-box/provider"
import { PostIdeaModal, type Attachment } from "@/components/post-idea-modal"
import { Page, PageTitle, pillClass, quietLinkClass, countOf } from "@/components/shell/page"
import { IdeaCard } from "@/components/visual/idea-card"
import { SupportButton } from "@/components/community/support-button"
import { useAuth } from "@/components/auth-provider"
import { Skeleton } from "@/components/visual/skeleton"

type Tab = "yours" | "discover"

type Stage = "concept" | "prototype" | "mvp" | "launched"
type StageValue = Stage | ""

interface Idea {
  id: string
  title: string
  author: string
  desc?: string
  tags: string[]
  stage?: StageValue
  funding?: string
  likes: number
  supportedByMe?: boolean
  comments: number
  views: number
  isYours?: boolean
  lookingFor?: string[]
  raising?: string
  milestones?: { status: "open" | "done" }[]
  description?: string
  isDraft?: boolean
  createdAt?: string
  attachments?: Attachment[]
  moderation?: { state: "hidden" | "removed" }
}

interface IdeaFormData {
  title: string
  description: string
  tags: string[]
  stage: StageValue
  lookingFor: string[]
  raising: string
  isDraft: boolean
  attachments?: Attachment[]
}



// Normalize MongoDB _id → id expected by the frontend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalize = (idea: any): Idea => ({
  ...idea,
  id: idea._id ?? idea.id,
  isYours: true, // set by callers that need it
})

type SaveResult = { idea: Idea; failedUploads: string[] }

// ---------- API Service ----------
// No local fallbacks: a failed request throws, so the page never shows a save that didn't happen.
const ideasAPI = {
  async fetchYourIdeas(): Promise<Idea[]> {
    const response = await apiClient.get("/ideas/user")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response.data as any[]).map((i) => ({ ...normalize(i), isYours: true }))
  },

  // Everyone's ideas include the founder's own: those get Edit, not Support.
  async fetchDiscoverIdeas(myId?: string): Promise<Idea[]> {
    const response = await apiClient.get("/ideas/discover")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response.data as any[]).map((i) => ({ ...normalize(i), isYours: Boolean(myId) && String(i.founder_id) === String(myId) }))
  },

  /** Uploads the not-yet-uploaded files and patches their URLs in; returns the names that failed. */
  async uploadFiles(idea: Idea, attachments: Attachment[] = []): Promise<string[]> {
    const pending = attachments.filter((a) => a.file)
    const results = await Promise.allSettled(
      pending.map(async (att) => {
        const fd = new FormData()
        fd.append("file", att.file!)
        const res = await apiClient.post<{ attachment: Attachment }>(
          `/ideas/${idea.id}/attachments`,
          fd,
          { headers: { "Content-Type": "multipart/form-data" } }
        )
        // The server stores a file only through this upload, so add what it returns.
        ;(idea.attachments ??= []).push(res.data.attachment)
      })
    )
    return pending.filter((_, i) => results[i].status === "rejected").map((a) => a.name)
  },

  async createIdea(data: IdeaFormData): Promise<SaveResult> {
    const { attachments: _files, ...fields } = data
    const response = await apiClient.post("/ideas", fields)
    const idea: Idea = { ...normalize(response.data), isYours: true }
    return { idea, failedUploads: await ideasAPI.uploadFiles(idea, data.attachments) }
  },

  async updateIdea(id: string, data: IdeaFormData): Promise<SaveResult> {
    // The files already uploaded that the founder kept (by URL); dropped ones are deleted.
    const kept = (data.attachments || []).filter((a) => a.url).map(({ file: _f, ...rest }) => rest)
    const response = await apiClient.put(`/ideas/${id}`, { ...data, attachments: kept })
    const idea: Idea = { ...normalize(response.data), isYours: true }
    return { idea, failedUploads: await ideasAPI.uploadFiles(idea, data.attachments) }
  },

  async deleteIdea(id: string): Promise<void> {
    await apiClient.delete(`/ideas/${id}`)
  },

}

// Outside the page: defined inside, every keystroke in the search made a new component type and
// remounted every card.
function IdeaRow({ idea, onEdit, onSupported }: {
  idea: Idea
  onEdit: (idea: Idea) => void
  onSupported: (ideaId: string, next: { supported: boolean; count: number }) => void
}) {
  const pill = "rounded-full border border-line px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
  return (
    <li>
      <IdeaCard
        href={`/founder/ideas/${idea.id}`}
        idea={{
          id: idea.id,
          title: idea.title,
          description: idea.desc || idea.description,
          sectors: idea.tags,
          stage: idea.stage,
          raising: idea.raising,
          author: idea.isYours ? undefined : idea.author,
          createdAt: idea.createdAt,
          milestones: idea.milestones,
          isDraft: idea.isDraft,
          moderation: idea.isYours ? idea.moderation?.state : undefined,
        }}
        action={
          idea.isYours ? (
            <button type="button" onClick={() => onEdit(idea)} className={pill}>Edit</button>
          ) : (
            <SupportButton
              ideaId={idea.id}
              supported={idea.supportedByMe}
              count={idea.likes}
              size="sm"
              onChange={(next) => onSupported(idea.id, next)}
            />
          )
        }
      />
      <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span>{countOf(idea.likes, "supporter")}</span>
        <span>{countOf(idea.comments, "comment")}</span>
        <span>{countOf(idea.views, "view")}</span>
        {idea.attachments && idea.attachments.length > 0 && <span>{countOf(idea.attachments.length, "file")}</span>}
        {idea.lookingFor && idea.lookingFor.length > 0 && (
          <span>Looking for {idea.lookingFor.map((r) => labelFor("roles", r)).join(", ")}</span>
        )}
      </p>
    </li>
  )
}

// ---------- Component ----------
export default function FounderIdeasPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>("yours")
  const [query, setQuery] = useState("")
  const [yourIdeas, setYourIdeas] = useState<Idea[]>([])
  const [discoverIdeas, setDiscoverIdeas] = useState<Idea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all")
  const [sortBy, setSortBy] = useState<"newest" | "likes" | "views">("newest")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [initialDescription, setInitialDescription] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("new") === "true") {
        // Text typed into the home page's "What are you working on?" box, if any.
        setInitialDescription(readIdeaDraft())
        setIsModalOpen(true)
        router.replace("/founder/ideas")
      }
    }
  }, [router])

  // quiet: refresh in place (no spinner), e.g. after the Something box fills in a stage.
  const loadIdeas = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true)
    setError(null)
    try {
      if (tab === "yours") {
        const ideas = await ideasAPI.fetchYourIdeas()
        setYourIdeas(ideas)
      } else {
        const ideas = await ideasAPI.fetchDiscoverIdeas(user?.id)
        setDiscoverIdeas(ideas)
      }
    } catch (err) {
      setError(apiError(err, "Couldn't load ideas."))
    } finally {
      setIsLoading(false)
    }
  }, [tab, user?.id])

  useEffect(() => {
    loadIdeas()
  }, [loadIdeas])

  // The Something box fires this after an answer, so a new stage or sector shows without a reload.
  useEffect(() => {
    const onUpdate = () => loadIdeas(true)
    window.addEventListener("profile:updated", onUpdate)
    return () => window.removeEventListener("profile:updated", onUpdate)
  }, [loadIdeas])

  const ideas = tab === "yours" ? yourIdeas : discoverIdeas
  const filtered = ideas
    .filter((idea) => {
      const matchesQuery =
        idea.title.toLowerCase().includes(query.toLowerCase()) ||
        idea.desc?.toLowerCase().includes(query.toLowerCase()) ||
        idea.description?.toLowerCase().includes(query.toLowerCase()) ||
        idea.tags.some((tag) => labelFor("sectors", tag).toLowerCase().includes(query.toLowerCase())) ||
        idea.author.toLowerCase().includes(query.toLowerCase())

      const matchesStage = stageFilter === "all" || idea.stage === stageFilter

      return matchesQuery && matchesStage
    })
    .sort((a, b) => {
      if (sortBy === "likes") return b.likes - a.likes
      if (sortBy === "views") return b.views - a.views
      const dateA = a.createdAt || ""
      const dateB = b.createdAt || ""
      return dateB.localeCompare(dateA)
    })

  function handleEditClick(idea: Idea) {
    setEditingIdea(idea)
    setIsModalOpen(true)
  }

  // ?edit=<id> (from the Something page's Readiness list) opens that idea's edit form once
  // the founder's ideas have loaded.
  const editParam = useRef<string | null>(null)
  useEffect(() => {
    editParam.current = new URLSearchParams(window.location.search).get("edit")
  }, [])
  useEffect(() => {
    const id = editParam.current
    if (!id || isLoading) return
    const target = yourIdeas.find((i) => String(i.id) === id)
    if (target) {
      editParam.current = null
      handleEditClick(target)
      router.replace("/founder/ideas")
    }
  }, [yourIdeas, isLoading, router])

  const somethingBox = useSomethingBox()

  // Files are uploaded after the idea is saved; say so if any didn't make it rather than dropping them quietly.
  function reportUploads(failed: string[]) {
    if (failed.length) {
      toast({
        title: "Idea saved, but some files didn't upload",
        description: `${failed.join(", ")}. Open the idea and attach them again.`,
        variant: "destructive",
      })
    }
  }

  // These throw on failure: the modal stays open with the text the founder typed and shows the error.
  async function handleIdeaSubmit(data: IdeaFormData) {
    let result: SaveResult
    try {
      result = await ideasAPI.createIdea(data)
    } catch (err) {
      throw new Error(apiError(err, "Your idea wasn't posted. Please try again."))
    }
    setYourIdeas((prev) => [result.idea, ...prev])
    setIsModalOpen(false)
    setInitialDescription("")
    clearIdeaDraft()
    reportUploads(result.failedUploads)
    // A public idea without a stage or sectors is hard for investors to find: ask for one now.
    if (!data.isDraft) somethingBox.requestJIT("publish_idea")
  }

  async function handleIdeaUpdate(ideaData: IdeaFormData) {
    if (!editingIdea) return
    let result: SaveResult
    try {
      result = await ideasAPI.updateIdea(editingIdea.id, ideaData)
    } catch (err) {
      throw new Error(apiError(err, "Your changes weren't saved. Please try again."))
    }
    setYourIdeas((prev) => prev.map((idea) => (idea.id === editingIdea.id ? result.idea : idea)))
    setEditingIdea(null)
    setIsModalOpen(false)
    reportUploads(result.failedUploads)
  }

  function handleModalSubmit(data: IdeaFormData) {
    return editingIdea ? handleIdeaUpdate(data) : handleIdeaSubmit(data)
  }

  async function handleModalDelete() {
    if (!editingIdea) return
    try {
      await ideasAPI.deleteIdea(editingIdea.id)
    } catch (err) {
      throw new Error(apiError(err, "The idea wasn't deleted. Please try again."))
    }
    setYourIdeas((prev) => prev.filter((idea) => idea.id !== editingIdea.id))
    setEditingIdea(null)
    setIsModalOpen(false)
  }

  // Keeps the counts under the cards in step with the Support button.
  function handleSupported(ideaId: string, next: { supported: boolean; count: number }) {
    const apply = (ideas: Idea[]) => ideas.map((idea) => (idea.id === ideaId ? { ...idea, likes: next.count, supportedByMe: next.supported } : idea))
    setDiscoverIdeas(apply)
  }

  const tabClass = (on: boolean) =>
    cn("text-[15px] transition-colors cursor-pointer", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")
  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
      on ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground",
    )

  return (
    <Page>
      <PageTitle
        title="Ideas"
        actions={
          <button type="button" onClick={() => { setEditingIdea(null); setIsModalOpen(true) }} className={pillClass}>
            Post an idea
          </button>
        }
      />

      <div className="mt-12 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-6" role="tablist">
          <button role="tab" aria-selected={tab === "yours"} onClick={() => setTab("yours")} className={tabClass(tab === "yours")}>
            Yours{yourIdeas.length ? ` (${yourIdeas.length})` : ""}
          </button>
          <button role="tab" aria-selected={tab === "discover"} onClick={() => setTab("discover")} className={tabClass(tab === "discover")}>
            Everyone&apos;s
          </button>
        </div>
        <div className="flex items-center gap-5">
          <input
            placeholder="Search by title, sector or founder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-full border border-input bg-transparent px-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none md:w-80"
          />
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className={quietLinkClass}>
            Filter
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:gap-12">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">Stage</p>
            <div className="flex flex-wrap gap-2">
              {(["all", "concept", "prototype", "mvp", "launched"] as const).map((st) => (
                <button key={st} onClick={() => setStageFilter(st)} className={chip(stageFilter === st)} aria-pressed={stageFilter === st}>
                  {st === "all" ? "Any" : labelFor("ideaStages", st)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">Sort</p>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "newest", label: "Newest" },
                { key: "likes", label: "Most supported" },
                { key: "views", label: "Most viewed" },
              ] as const).map((o) => (
                <button key={o.key} onClick={() => setSortBy(o.key)} className={chip(sortBy === o.key)} aria-pressed={sortBy === o.key}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-10">
        {error ? (
          <div role="alert" className="flex items-baseline gap-5">
            <p className="text-[15px] text-destructive">{error}</p>
            <button type="button" onClick={() => loadIdeas()} className={quietLinkClass}>Retry</button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading ideas">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">
            {query || stageFilter !== "all"
              ? "No ideas match. Try another search or clear the filter."
              : tab === "yours"
                ? "You haven't posted an idea yet. A title and a few sentences are enough."
                : "No one has posted an idea yet."}
          </p>
        ) : (
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} onEdit={handleEditClick} onSupported={handleSupported} />
            ))}
          </ul>
        )}
      </div>

      <PostIdeaModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingIdea(null)
          setInitialDescription("")
          clearIdeaDraft()
        }}
        onSubmit={handleModalSubmit}
        onDelete={editingIdea ? handleModalDelete : undefined}
        editingIdea={editingIdea}
        initialDescription={initialDescription}
      />
    </Page>
  )
}
