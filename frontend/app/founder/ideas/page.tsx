"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Filter, Eye, MessageSquare, Heart, Edit, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PostIdeaModal, type Attachment } from "@/components/post-idea-modal"
import { PageHeader } from "@/components/page-header"

type Tab = "yours" | "discover"

type Stage = "concept" | "prototype" | "mvp" | "launched"

interface Idea {
  id: string
  title: string
  author: string
  desc?: string
  tags: string[]
  stage: Stage
  funding?: string
  likes: number
  comments: number
  views: number
  isYours?: boolean
  lookingFor?: string[]
  description?: string
  isDraft?: boolean
  createdAt?: string
  attachments?: Attachment[]
}

interface IdeaFormData {
  title: string
  description: string
  tags: string[]
  stage: Stage
  lookingFor: string[]
  isDraft: boolean
  attachments?: Attachment[]
}



function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue
  const saved = localStorage.getItem(key)
  return saved ? JSON.parse(saved) : defaultValue
}

function setLocalStorageItem<T>(key: string, value: T): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value))
  }
}

// Normalize MongoDB _id → id expected by the frontend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalize = (idea: any): Idea => ({
  ...idea,
  id: idea._id ?? idea.id,
  isYours: true, // set by callers that need it
})

// ---------- API Service ----------
const ideasAPI = {
  async fetchYourIdeas(): Promise<Idea[]> {
    try {
      const response = await apiClient.get("/ideas/user")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (response.data as any[]).map((i) => ({ ...normalize(i), isYours: true }))
    } catch (error) {
      console.error("fetchYourIdeas failed", error)
      return getLocalStorageItem<Idea[]>("founder_your_ideas", [])
    }
  },

  async fetchDiscoverIdeas(): Promise<Idea[]> {
    try {
      const response = await apiClient.get("/ideas/discover")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (response.data as any[]).map((i) => ({ ...normalize(i), isYours: false }))
    } catch (error) {
      console.error("fetchDiscoverIdeas failed", error)
      return getLocalStorageItem<Idea[]>("founder_discover_ideas", [])
    }
  },

  async createIdea(data: IdeaFormData): Promise<Idea> {
    // Separate file objects from metadata before sending JSON to /ideas
    const pendingFiles = (data.attachments || []).filter(a => a.file)
    const metaOnly = (data.attachments || []).map(({ file: _f, ...rest }) => rest)

    try {
      const response = await apiClient.post("/ideas", { ...data, attachments: metaOnly })
      const created: Idea = { ...normalize(response.data), isYours: true }

      // Upload any attached files now that we have the idea ID
      if (pendingFiles.length > 0) {
        await Promise.allSettled(
          pendingFiles.map(async (att) => {
            if (!att.file) return
            const fd = new FormData()
            fd.append("file", att.file)
            try {
              const uploadRes = await apiClient.post<{ attachment: { url: string; name: string } }>(
                `/ideas/${created.id}/attachments`,
                fd,
                { headers: { "Content-Type": "multipart/form-data" } }
              )
              // Patch the url into the matching attachment on the created idea
              if (created.attachments) {
                const idx = created.attachments.findIndex(a => a.name === att.name)
                if (idx !== -1) created.attachments[idx].url = uploadRes.data.attachment.url
              }
            } catch (err) {
              console.warn(`Failed to upload attachment ${att.name}:`, err)
            }
          })
        )
      }

      return created
    } catch (error) {
      console.warn("createIdea failed, saving locally", error)
      const list = getLocalStorageItem<Idea[]>("founder_your_ideas", [])
      const newIdea: Idea = {
        id: `local-${Date.now()}`,
        title: data.title,
        author: "You",
        desc: data.description.slice(0, 120) + (data.description.length > 120 ? "..." : ""),
        description: data.description,
        tags: data.tags,
        stage: data.stage,
        likes: 0,
        comments: 0,
        views: 1,
        isYours: true,
        lookingFor: data.lookingFor,
        isDraft: data.isDraft,
        createdAt: new Date().toISOString().split("T")[0],
        attachments: metaOnly,
      }
      setLocalStorageItem("founder_your_ideas", [newIdea, ...list])
      return newIdea
    }
  },

  async updateIdea(id: string, data: IdeaFormData): Promise<Idea> {
    // Separate new File objects (not yet uploaded) from already-uploaded attachments
    const pendingFiles = (data.attachments || []).filter(a => a.file)
    const metaOnly = (data.attachments || []).map(({ file: _f, ...rest }) => rest)

    try {
      const response = await apiClient.put(`/ideas/${id}`, { ...data, attachments: metaOnly })
      const updated: Idea = { ...normalize(response.data), isYours: true }

      // Upload any new files
      if (pendingFiles.length > 0) {
        await Promise.allSettled(
          pendingFiles.map(async (att) => {
            if (!att.file) return
            const fd = new FormData()
            fd.append("file", att.file)
            try {
              const uploadRes = await apiClient.post<{ attachment: { url: string; name: string } }>(
                `/ideas/${id}/attachments`,
                fd,
                { headers: { "Content-Type": "multipart/form-data" } }
              )
              if (updated.attachments) {
                const idx = updated.attachments.findIndex(a => a.name === att.name)
                if (idx !== -1) updated.attachments[idx].url = uploadRes.data.attachment.url
              }
            } catch (err) {
              console.warn(`Failed to upload attachment ${att.name}:`, err)
            }
          })
        )
      }

      return updated
    } catch (error) {
      console.warn("updateIdea failed, saving locally", error)
      const list = getLocalStorageItem<Idea[]>("founder_your_ideas", [])
      let updatedIdea: Idea | null = null
      const updatedList = list.map((idea) => {
        if (idea.id === id) {
          updatedIdea = {
            ...idea,
            title: data.title,
            desc: data.description.slice(0, 120) + (data.description.length > 120 ? "..." : ""),
            description: data.description,
            tags: data.tags,
            stage: data.stage,
            lookingFor: data.lookingFor,
            isDraft: data.isDraft,
            attachments: metaOnly,
          }
          return updatedIdea
        }
        return idea
      })
      if (!updatedIdea) throw new Error("Idea not found for update")
      setLocalStorageItem("founder_your_ideas", updatedList)
      return updatedIdea
    }
  },

  async deleteIdea(id: string): Promise<void> {
    try {
      await apiClient.delete(`/ideas/${id}`)
    } catch (error) {
      console.warn("deleteIdea failed, mocking locally", error)
      const list = getLocalStorageItem<Idea[]>("founder_your_ideas", [])
      setLocalStorageItem("founder_your_ideas", list.filter((idea) => idea.id !== id))
    }
  },

  async likeIdea(id: string): Promise<void> {
    try {
      await apiClient.post(`/ideas/${id}/like`, {})
    } catch (error) {
      console.warn("likeIdea failed, mocking locally", error)
      const yourList = getLocalStorageItem<Idea[]>("founder_your_ideas", [])
      setLocalStorageItem(
        "founder_your_ideas",
        yourList.map((idea) => (idea.id === id ? { ...idea, likes: idea.likes + 1 } : idea))
      )
      const discoverList = getLocalStorageItem<Idea[]>("founder_discover_ideas", [])
      setLocalStorageItem(
        "founder_discover_ideas",
        discoverList.map((idea) => (idea.id === id ? { ...idea, likes: idea.likes + 1 } : idea))
      )
    }
  },

  async getIdeaById(id: string): Promise<Idea> {
    try {
      const response = await apiClient.get(`/ideas/${id}`)
      return normalize(response.data)
    } catch (error) {
      console.warn("getIdeaById failed, mocking locally", error)
      const allIdeas = [
        ...getLocalStorageItem<Idea[]>("founder_your_ideas", []),
        ...getLocalStorageItem<Idea[]>("founder_discover_ideas", []),
      ]
      const found = allIdeas.find((idea) => idea.id === id)
      if (found) return found
      throw new Error("Idea not found")
    }
  },
}

// ---------- Component ----------
export default function FounderIdeasPage() {
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
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("new") === "true") {
        setIsModalOpen(true)
        router.replace("/founder/ideas")
      }
    }
  }, [router])

  const loadIdeas = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (tab === "yours") {
        const ideas = await ideasAPI.fetchYourIdeas()
        setYourIdeas(ideas)
      } else {
        const ideas = await ideasAPI.fetchDiscoverIdeas()
        setDiscoverIdeas(ideas)
      }
    } catch (err) {
      setError("Failed to load ideas. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [tab])

  useEffect(() => {
    loadIdeas()
  }, [loadIdeas])

  // Sync state if localStorage updates
  useEffect(() => {
    const handleStorageChange = () => {
      loadIdeas()
    }
    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [loadIdeas])

  const ideas = tab === "yours" ? yourIdeas : discoverIdeas
  const filtered = ideas
    .filter((idea) => {
      const matchesQuery =
        idea.title.toLowerCase().includes(query.toLowerCase()) ||
        idea.desc?.toLowerCase().includes(query.toLowerCase()) ||
        idea.description?.toLowerCase().includes(query.toLowerCase()) ||
        idea.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())) ||
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

  async function handleIdeaSubmit(data: IdeaFormData) {
    try {
      const newIdea = await ideasAPI.createIdea(data)
      setYourIdeas((prev) => [newIdea, ...prev])
      setIsModalOpen(false)
    } catch (err) {
      console.error("Failed to create idea:", err)
      setError("Failed to create idea. Please try again.")
    }
  }

  async function handleIdeaUpdate(ideaData: IdeaFormData) {
    if (!editingIdea) return
    try {
      const updatedIdea = await ideasAPI.updateIdea(editingIdea.id, ideaData)
      setYourIdeas((prev) => prev.map((idea) => (idea.id === editingIdea.id ? updatedIdea : idea)))
      setEditingIdea(null)
      setIsModalOpen(false)
    } catch (err) {
      console.error("Failed to update idea:", err)
      setError("Failed to update idea. Please try again.")
    }
  }

  function handleModalSubmit(data: IdeaFormData) {
    if (editingIdea) {
      handleIdeaUpdate(data)
    } else {
      handleIdeaSubmit(data)
    }
  }

  async function handleModalDelete() {
    if (!editingIdea) return
    try {
      await ideasAPI.deleteIdea(editingIdea.id)
      setYourIdeas((prev) => prev.filter((idea) => idea.id !== editingIdea.id))
      setEditingIdea(null)
      setIsModalOpen(false)
    } catch (err) {
      console.error("Failed to delete idea:", err)
      setError("Failed to delete idea. Please try again.")
    }
  }

  function handleViewClick(idea: Idea) {
    if (!idea.isYours) router.push(`/founder/ideas/${idea.id}`)
  }

  async function handleLikeIdea(ideaId: string) {
    try {
      await ideasAPI.likeIdea(ideaId)
      const updateIdeas = (ideas: Idea[]) =>
        ideas.map((idea) =>
          idea.id === ideaId ? { ...idea, likes: idea.likes + 1 } : idea
        )
      if (tab === "yours") {
  setYourIdeas(updateIdeas)
} else {
  setDiscoverIdeas(updateIdeas)
}
    } catch (err) {
      console.error("Failed to like idea:", err)
    }
  }

  function IdeaRow({ idea }: { idea: Idea }) {
    const stageColors = {
      launched: { text: "text-brand-accent", bg: "bg-brand-accent/5", border: "border-brand-accent/10" },
      mvp: { text: "text-[#8293A4]", bg: "bg-[#8293A4]/5", border: "border-[#8293A4]/10" },
      prototype: { text: "text-[#C88E72]", bg: "bg-[#C88E72]/5", border: "border-[#C88E72]/10" },
      concept: { text: "text-foreground/40", bg: "bg-foreground/[0.02]", border: "border-border/[0.05]" }
    }[idea.stage] ?? { text: "text-foreground/40", bg: "bg-foreground/[0.02]", border: "border-border/[0.05]" }

    return (
      <div className="py-10 transition-colors group flex flex-col justify-between gap-6 border-b border-border/[0.04] last:border-b-0">
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-serif font-light text-lg leading-snug tracking-tight text-foreground group-hover:text-brand-accent transition-colors">
                  {idea.title}
                </h3>
                {idea.isDraft && (
                  <Badge className="bg-[#C88E72]/5 text-[#C88E72] border-[#C88E72]/10 text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border">
                    Draft
                  </Badge>
                )}
                {idea.attachments && idea.attachments.length > 0 && (
                  <Badge className="bg-emerald-500/5 text-emerald-400 border-emerald-500/10 text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 font-mono">
                    📎 {idea.attachments.length} {idea.attachments.length === 1 ? "Pitch" : "Pitches"}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] font-mono text-foreground/30 tracking-wide">by {idea.author}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                className={cn(
                  "text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full border",
                  stageColors.text, stageColors.bg, stageColors.border
                )}
              >
                {idea.stage.toUpperCase()}
              </Badge>
              {idea.isYours && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditClick(idea)}
                  className="h-7 w-7 text-foreground/30 hover:text-foreground hover:bg-foreground/5 rounded-full cursor-pointer"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-foreground/55 font-light leading-relaxed font-sans">{idea.desc || idea.description}</p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {idea.tags.map((tag) => (
              <Badge key={tag} className="bg-foreground/[0.01] text-foreground/35 border-border/[0.03] text-[11px] font-mono rounded-md py-0.5 px-2">
                #{tag}
              </Badge>
            ))}
          </div>

          {idea.lookingFor && idea.lookingFor.length > 0 && (
            <div className="flex items-center gap-2 pt-1.5">
              <span className="text-[11px] text-foreground/30 font-semibold uppercase tracking-widest font-mono">Looking for:</span>
              <div className="flex flex-wrap gap-1.5">
                {idea.lookingFor.map((item) => (
                  <Badge
                    key={item}
                    className="bg-foreground/[0.01] text-foreground/50 border-border/[0.03] text-[9.5px] rounded px-1.5 py-0.5"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-4.5 text-xs font-mono text-foreground/30">
            <button
              onClick={() => handleLikeIdea(idea.id)}
              className="flex items-center gap-1.5 hover:text-[#F472B6] transition-colors cursor-pointer"
            >
              <Heart className="h-3.5 w-3.5" />
              <span>{idea.likes}</span>
            </button>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{idea.comments}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              <span>{idea.views}</span>
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => handleViewClick(idea)}
            className="h-7 text-[11px] font-semibold rounded-full border-border/10 text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-all px-4 cursor-pointer bg-transparent"
          >
            {idea.isYours ? "Share" : "Explore"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12">
      <PageHeader
        category="Ideas Workspace"
        title="Ideas & Drafts"
        description="Share cohort submissions, organize build specifications, and explore developer telemetry."
        accentColor="emerald"
        action={
          <Button onClick={() => { setEditingIdea(null); setIsModalOpen(true); }} className="rounded-full text-xs font-semibold px-6 py-2.5 bg-foreground text-background hover:bg-brand-accent hover:text-background transition-all duration-300 active:scale-[0.98] cursor-pointer">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Post new idea
          </Button>
        }
      />

      {/* Tabs and search (Capsule UI style like Claude) */}
      <div className="py-6 border-y border-border/[0.03]">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="flex rounded-full border border-border/[0.03] bg-background/30 p-1 shrink-0">
            <button
              onClick={() => setTab("yours")}
              className={cn(
                "px-5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer",
                tab === "yours" ? "bg-primary text-primary-foreground shadow-md" : "text-foreground/40 hover:text-foreground/80"
              )}
            >
              Your ideas ({yourIdeas.length})
            </button>
            <button
              onClick={() => setTab("discover")}
              className={cn(
                "px-5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer",
                tab === "discover" ? "bg-primary text-primary-foreground shadow-md" : "text-foreground/40 hover:text-foreground/80"
              )}
            >
              Discover
            </button>
          </div>

          <div className="flex gap-2 flex-1 items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
              <Input
                placeholder="Search ideas, tags, authors…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-9.5 bg-background/30 border-border/[0.03] text-foreground placeholder:text-foreground/20 rounded-full focus-visible:ring-brand-accent focus-visible:border-brand-accent/25 focus:bg-background/50 transition-all font-sans"
              />
            </div>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className={cn(
                "h-9.5 border-border/10 text-foreground/70 hover:bg-foreground/5 hover:text-foreground rounded-full px-4.5 text-xs font-semibold bg-transparent transition-all cursor-pointer",
                showFilters && "bg-foreground/5 border-border/20 text-foreground"
              )}
            >
              <Filter className="mr-2 h-4 w-4 text-foreground/30" />
              Filter
            </Button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="border-t border-border/[0.03] mt-4 pt-4 space-y-4 transition-all duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Stage Filter */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.15em] text-foreground/30 font-semibold font-mono block">Project Stage</span>
                <div className="flex flex-wrap gap-1.5">
                  {["all", "concept", "prototype", "mvp", "launched"].map((stageOpt) => (
                    <button
                      key={stageOpt}
                      onClick={() => setStageFilter(stageOpt as "all" | Stage)}
                      className={cn(
                        "px-3 py-1 rounded-full border text-xs font-medium transition-all capitalize cursor-pointer",
                        stageFilter === stageOpt
                          ? "border-brand-accent/30 bg-brand-accent/10 text-brand-accent"
                          : "border-border/5 bg-transparent text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {stageOpt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sorting Filter */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.15em] text-foreground/30 font-semibold font-mono block">Sort Criteria</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "newest", label: "Newest Releases" },
                    { key: "likes", label: "Most Conviction" },
                    { key: "views", label: "Most Viewed" },
                  ].map((sortOpt) => (
                    <button
                      key={sortOpt.key}
                      onClick={() => setSortBy(sortOpt.key as "newest" | "likes" | "views")}
                      className={cn(
                        "px-3 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer",
                        sortBy === sortOpt.key
                          ? "border-brand-accent/30 bg-brand-accent/10 text-brand-accent"
                          : "border-border/5 bg-transparent text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {sortOpt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-400 text-xs font-medium">{error}</p>
        </div>
      )}

      {/* Grid rendering */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/20" />
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            {filtered.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 rounded-2xl border border-dashed border-border/5 bg-foreground/[0.002]">
              <div className="text-foreground/30 text-xs">No ideas found matching your search.</div>
            </div>
          )}
        </>
      )}

      <PostIdeaModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingIdea(null)
        }}
        onSubmit={handleModalSubmit}
        onDelete={editingIdea ? handleModalDelete : undefined}
        editingIdea={editingIdea}
      />
    </div>
  )
}
