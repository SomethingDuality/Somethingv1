"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, MessageSquare, Heart, Loader2, AlertTriangle, ArrowBigUp, ArrowBigDown, Flag, Send, Share2, Download, Paperclip, Film, Volume2, FileText, Presentation, Coins } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"


type Stage = "concept" | "prototype" | "mvp" | "launched"

export interface Attachment {
  name: string
  size: string
  type: "presentation" | "video" | "audio" | "document"
  url?: string
}

interface Idea {
  id: string
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
  communityTarget?: number
  communityRaised?: number
  investmentNeeded?: number
  fundsGained?: number
  fundsSpent?: number
}

interface Comment {
  id: string
  author: string
  authorAvatar: string
  text: string
  timestamp: string
}

const FALLBACK_IDEAS: Record<string, Idea> = {}

export default function IdeaDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [idea, setIdea] = useState<Idea | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Feedback states
  const [userName, setUserName] = useState("")
  const [userAvatar, setUserAvatar] = useState("")
  const [commentInput, setCommentInput] = useState("")
  const [flagReasonText, setFlagReasonText] = useState("")
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false)
  
  // Pledge states
  const [isPledgeModalOpen, setIsPledgeModalOpen] = useState(false)
  const [pledgeInput, setPledgeInput] = useState("")
  const [customPledgeError, setCustomPledgeError] = useState<string | null>(null)

  const handleShareClick = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: "Link Copied",
        description: "Project specification link copied to your clipboard.",
      })
    }
  }

  const [isCollaborating, setIsCollaborating] = useState(false)

  const handleCollaborate = async () => {
    if (!id) return
    setIsCollaborating(true)
    try {
      await apiClient.post(`/ideas/${id}/collaborate`)
      toast({
        title: "Request Sent",
        description: "Collaboration request sent successfully. The founder has been notified.",
      })
    } catch (err: any) {
      console.error(err)
      const msg = err.response?.data?.message || "Failed to send collaboration request. Please try again."
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setIsCollaborating(false)
    }
  }


  useEffect(() => {
    if (typeof window !== "undefined") {
      const name = localStorage.getItem("demo_name")
      if (name) setUserName(name)

      const storedProfile = localStorage.getItem("founder_profile_data")
      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile)
          if (parsed.avatarUrl) setUserAvatar(parsed.avatarUrl)
        } catch { /* ignore */ }
      }
    }
  }, [])

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      
      let ideaData: any = null
      try {
        const res = await apiClient.get(`/ideas/${id}`)
        ideaData = res.data
      } catch (err) {
        console.warn("Failed to fetch idea from API, using fallback:", err)
      }

      try {
        const { getCommunityStats } = require("@/lib/community-api")
        const commStats = await getCommunityStats(id)

        if (ideaData) {
          setIdea({
            ...ideaData,
            id: ideaData._id ?? ideaData.id,
            commentsCount: ideaData.comments ?? 0,
            communityTarget: commStats.communityTarget,
            communityRaised: commStats.communityRaised,
            investmentNeeded: ideaData.fundingGoal ?? 25000,
            fundsGained: ideaData.fundsGained ?? 0,
            fundsSpent: ideaData.fundsSpent ?? 0,
          })
        } else {
          const { getProjectById } = require("@/lib/projects-store")
          const storeProj = getProjectById(id)
          if (storeProj) {
            setIdea({
              id: storeProj.id,
              title: storeProj.name,
              author: storeProj.author,
              authorHeadline: storeProj.authorHeadline,
              stage: storeProj.stage,
              tags: storeProj.domains,
              description: storeProj.description,
              lookingFor: [],
              likes: storeProj.likes,
              commentsCount: storeProj.commentsCount,
              communityTarget: commStats.communityTarget,
              communityRaised: commStats.communityRaised,
              investmentNeeded: storeProj.investmentNeeded,
              fundsGained: storeProj.fundsGained,
              fundsSpent: storeProj.fundsSpent,
              attachments: storeProj.attachments,
            })
          } else {
            setError("Could not load the idea specifications.")
            setIsLoading(false)
            return
          }
        }

        // Fetch comments
        try {
          const commentsRes = await apiClient.get<Comment[]>(`/ideas/${id}/comments`)
          setComments(commentsRes.data)
        } catch (err) {
          console.warn("Failed to fetch comments from API, falling back to local storage:", err)
          const commentsKey = `comments_${id}`
          const storedComments = localStorage.getItem(commentsKey)
          setComments(storedComments ? JSON.parse(storedComments) : [])
        }
      } catch (err) {
        setError("Could not load the idea specifications.")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [id])

  const saveIdeaState = (updatedIdea: Idea) => {
    setIdea(updatedIdea)

    // Save back to lists
    const yourStored = localStorage.getItem("founder_your_ideas")
    const discStored = localStorage.getItem("founder_discover_ideas")

    if (yourStored) {
      const list = JSON.parse(yourStored) as Idea[]
      const idx = list.findIndex(x => x.id === updatedIdea.id)
      if (idx !== -1) {
        list[idx] = updatedIdea
        localStorage.setItem("founder_your_ideas", JSON.stringify(list))
      }
    }
    if (discStored) {
      const list = JSON.parse(discStored) as Idea[]
      const idx = list.findIndex(x => x.id === updatedIdea.id)
      if (idx !== -1) {
        list[idx] = updatedIdea
        localStorage.setItem("founder_discover_ideas", JSON.stringify(list))
      }
    }
  }

  const handlePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idea) return

    const amount = parseInt(pledgeInput)
    if (isNaN(amount) || amount <= 0) {
      setCustomPledgeError("Please enter a valid positive amount.")
      return
    }

    try {
      const { submitCommunityPledge } = require("@/lib/community-api")
      const result = await submitCommunityPledge(idea.id, amount, userName, "Pledged support via details feed.")
      
      if (result.success) {
        const updatedIdea: Idea = {
          ...idea,
          communityRaised: result.communityRaised
        }
        saveIdeaState(updatedIdea)
        
        toast({
          title: "Pledge Recorded",
          description: `Thank you! You have pledged ₹${amount.toLocaleString()} to support "${idea.title}".`,
        })
        setIsPledgeModalOpen(false)
        setPledgeInput("")
        
        window.dispatchEvent(new CustomEvent("global-projects-updated"))
      } else {
        throw new Error("Pledge submission rejected")
      }
    } catch (err) {
      console.error(err)
      toast({
        title: "Error Pledging",
        description: "Could not find backing data for this project in local store.",
        variant: "destructive"
      })
    }
  }

  const handleVote = (dir: "up" | "down") => {
    if (!idea) return
    const voteKey = `vote_idea_${id}`
    const prevVote = localStorage.getItem(voteKey)

    let likesDelta = 0
    let downDelta = 0

    if (dir === "up") {
      if (prevVote === "up") {
        likesDelta = -1
        localStorage.removeItem(voteKey)
      } else if (prevVote === "down") {
        likesDelta = 1
        downDelta = -1
        localStorage.setItem(voteKey, "up")
      } else {
        likesDelta = 1
        localStorage.setItem(voteKey, "up")
      }
    } else {
      const currentDown = idea.downvotes || 0
      if (prevVote === "down") {
        downDelta = -1
        localStorage.removeItem(voteKey)
      } else if (prevVote === "up") {
        downDelta = 1
        likesDelta = -1
        localStorage.setItem(voteKey, "down")
      } else {
        downDelta = 1
        localStorage.setItem(voteKey, "down")
      }
    }

    const updated: Idea = {
      ...idea,
      likes: Math.max(0, idea.likes + likesDelta),
      downvotes: Math.max(0, (idea.downvotes || 0) + downDelta)
    }
    saveIdeaState(updated)
  }

  const handleAddComment = async () => {
    if (!idea || !commentInput.trim()) return

    const commentText = commentInput.trim()
    setCommentInput("")

    try {
      const res = await apiClient.post<{ success: boolean; comment: Comment }>(`/ideas/${id}/comments`, { text: commentText })
      if (res.data?.success && res.data.comment) {
        const serverComment = res.data.comment
        const updatedComments = [...comments, serverComment]
        setComments(updatedComments)
        localStorage.setItem(`comments_${id}`, JSON.stringify(updatedComments))

        const updatedIdea: Idea = {
          ...idea,
          commentsCount: updatedComments.length
        }
        saveIdeaState(updatedIdea)
      }
    } catch (err) {
      console.error("handleAddComment failed, using offline fallback", err)
      const newComment: Comment = {
        id: `c-${Date.now()}`,
        author: userName || "Anonymous",
        authorAvatar: userAvatar,
        text: commentText,
        timestamp: "Just now"
      }

      const updatedComments = [...comments, newComment]
      setComments(updatedComments)
      localStorage.setItem(`comments_${id}`, JSON.stringify(updatedComments))

      const updatedIdea: Idea = {
        ...idea,
        commentsCount: updatedComments.length
      }
      saveIdeaState(updatedIdea)
    }
  }

  const handleFlagIdea = () => {
    if (!idea) return
    const updated: Idea = {
      ...idea,
      flagged: true,
      flagReason: flagReasonText || "Reported for community guidelines review"
    }
    saveIdeaState(updated)
    setIsFlagModalOpen(false)
    setFlagReasonText("")
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/60" />
      </div>
    )
  }

  if (error || !idea) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">An Error Occurred</h2>
        <p className="text-foreground/70 mb-4">{error || "Idea not found."}</p>
        <Button onClick={() => router.back()} variant="outline" className="border-border/20">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    )
  }

  const stageInfo = {
    launched: { text: "text-brand-accent", bg: "bg-brand-accent/10", border: "border-brand-accent/20" },
    mvp: { text: "text-[#8293A4]", bg: "bg-[#8293A4]/10", border: "border-[#8293A4]/20" },
    prototype: { text: "text-[#C88E72]", bg: "bg-[#C88E72]/10", border: "border-[#C88E72]/20" },
    concept: { text: "text-foreground/60", bg: "bg-foreground/5", border: "border-border/10" }
  }[idea.stage] ?? { text: "text-foreground/60", bg: "bg-foreground/5", border: "border-border/10" }

  const netScore = idea.likes - (idea.downvotes || 0)

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Back and Share Buttons */}
        <div className="flex items-center justify-between">
          <Button onClick={() => router.back()} variant="ghost" className="text-foreground/55 hover:text-foreground hover:bg-foreground/[0.03] rounded-full px-4 h-8 text-xs font-semibold cursor-pointer">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to workspace
          </Button>
          <Button
            onClick={handleShareClick}
            variant="outline"
            className="text-foreground/70 hover:text-foreground border-border/40 hover:bg-foreground/[0.03] rounded-full px-4.5 h-8 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" /> Share Idea
          </Button>
        </div>

        {/* Idea Content */}
        <div className={cn(
          "relative overflow-hidden rounded-xl border border-border/[0.03] bg-background/10 shadow-lg",
          idea.flagged && "border-rose-500/20 bg-rose-500/[0.01]"
        )}>
          {/* Subtle backdrop glow */}
          <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-brand-accent/2 blur-3xl pointer-events-none" />
          
          <div className="p-8 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="space-y-1">
                <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground/95">
                  {idea.title}
                </h1>
                {idea.flagged && (
                  <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-mono px-2 py-0.5 mt-1">
                    ⚠️ FLAGGED: REVIEW PENDING
                  </Badge>
                )}
              </div>
              <Badge
                className={cn(
                  "text-[11px] font-semibold tracking-wider uppercase px-3 py-0.5 rounded-full border",
                  stageInfo.text, stageInfo.bg, stageInfo.border
                )}
              >
                {idea.stage.toUpperCase()}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-8">
              {idea.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="bg-foreground/[0.01] text-foreground/40 border-border/[0.03] text-[9.5px] font-mono rounded px-2 py-0.5"
                >
                  #{tag}
                </Badge>
              ))}
            </div>

            <p className="text-foreground/70 whitespace-pre-line text-sm sm:text-[14.5px] leading-relaxed font-sans font-light max-w-3xl">
              {idea.description}
            </p>
          </div>

          {/* Looking For block */}
          {idea.lookingFor && idea.lookingFor.length > 0 && (
            <div className="border-t border-border/[0.03] bg-foreground/[0.002] p-8">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-foreground/35 mb-4">Looking For</h3>
              <div className="flex flex-wrap gap-2">
                {idea.lookingFor.map((item) => (
                  <Badge key={item} className="text-[11px] font-medium border-border/10 text-foreground bg-foreground/[0.01] rounded px-3 py-1">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pitch Materials Section */}
        {idea.attachments && idea.attachments.length > 0 && (() => {
          const typeConfig = {
            presentation: {
              Icon: Presentation,
              label: "Presentation Deck",
              color: "text-blue-400",
              border: "border-blue-500/20",
              bg: "bg-blue-500/5",
              hoverBg: "hover:bg-blue-500/10",
              dot: "bg-blue-400",
              badgeBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
            },
            video: {
              Icon: Film,
              label: "Pitch Video",
              color: "text-purple-400",
              border: "border-purple-500/20",
              bg: "bg-purple-500/5",
              hoverBg: "hover:bg-purple-500/10",
              dot: "bg-purple-400",
              badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            },
            audio: {
              Icon: Volume2,
              label: "Audio Pitch",
              color: "text-amber-400",
              border: "border-amber-500/20",
              bg: "bg-amber-500/5",
              hoverBg: "hover:bg-amber-500/10",
              dot: "bg-amber-400",
              badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            },
            document: {
              Icon: FileText,
              label: "Document",
              color: "text-rose-400",
              border: "border-rose-500/20",
              bg: "bg-rose-500/5",
              hoverBg: "hover:bg-rose-500/10",
              dot: "bg-rose-400",
              badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
            },
          }
          return (
            <div className="rounded-xl border border-border/[0.03] bg-background/10 shadow-md hover:border-border/10 transition-all duration-300">
              <div className="p-6 pb-4 flex items-center justify-between border-b border-border/[0.03]">
                <div className="flex items-center gap-2.5">
                  <Paperclip className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-foreground/50">
                    Pitch Materials
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {idea.attachments.length} {idea.attachments.length === 1 ? "file" : "files"}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {idea.attachments.map((file, idx) => {
                    const cfg = typeConfig[file.type] ?? typeConfig.document
                    const { Icon } = cfg
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "group relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 cursor-default",
                          cfg.border, cfg.bg, cfg.hoverBg
                        )}
                      >
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className={cn(
                            "flex items-center justify-center h-9 w-9 rounded-lg border shrink-0",
                            cfg.border, cfg.bg
                          )}>
                            <Icon className={cn("h-4 w-4", cfg.color)} />
                          </div>
                          <span className={cn(
                            "text-[9px] font-mono font-bold uppercase tracking-widest border rounded-full px-2 py-0.5 mt-0.5",
                            cfg.badgeBg
                          )}>
                            {cfg.label}
                          </span>
                        </div>

                        {/* File name */}
                        <div className="min-w-0">
                          <p className={cn("text-[12px] font-semibold font-mono truncate", cfg.color)}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-foreground/35 font-mono mt-0.5">
                            {file.size}
                          </p>
                        </div>

                        {/* Download / Preview button */}
                        {file.url ? (
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}${file.url}`}
                            target="_blank"
                            rel="noreferrer"
                            download={file.name}
                            className={cn(
                              "flex items-center justify-center gap-1.5 w-full h-8 rounded-lg border text-[10px] font-semibold font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100 no-underline",
                              cfg.color, cfg.border, "hover:bg-foreground/5"
                            )}
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </a>
                        ) : (
                          <div
                            className={cn(
                              "flex items-center justify-center gap-1.5 w-full h-8 rounded-lg border text-[10px] font-semibold font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 cursor-not-allowed",
                              cfg.color, cfg.border, "opacity-40"
                            )}
                            title="File not yet uploaded to server"
                          >
                            <Download className="h-3 w-3" />
                            Unavailable
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Funding Pools: Community (Pledges) & Investor (Escrow) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Community Card */}
          <Card className="relative overflow-hidden bg-background/10 border-border/[0.03] rounded-xl shadow-md p-6 space-y-4">
            <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-brand-accent/2 blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-foreground/35">Community Funding Pool</h3>
                <div className="text-2xl font-serif font-light text-foreground">
                  ₹{(idea.communityRaised || 0).toLocaleString()} <span className="text-xs text-foreground/40">raised of ₹{(idea.communityTarget || 25000).toLocaleString()}</span>
                </div>
              </div>
              {idea.author !== "You" ? (
                <Button
                  onClick={() => setIsPledgeModalOpen(true)}
                  className="h-9 rounded-full bg-foreground text-background hover:bg-brand-accent hover:text-background text-xs font-semibold px-5 transition-all duration-300 cursor-pointer"
                >
                  Back this Project
                </Button>
              ) : (
                <Badge className="bg-brand-accent/10 text-brand-accent border border-brand-accent/20 text-[11px] font-mono px-3 py-1 rounded-full">
                  Your Campaign Active
                </Badge>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-foreground/5 overflow-hidden">
                <div
                  className="h-full bg-brand-accent transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((idea.communityRaised || 0) / (idea.communityTarget || 25000)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-foreground/30">
                <span>{Math.round(((idea.communityRaised || 0) / (idea.communityTarget || 25000)) * 100)}% Funded</span>
                <span>Active Community Escrow</span>
              </div>
            </div>
          </Card>

          {/* Investor Card */}
          <Card className="relative overflow-hidden bg-background/10 border-border/[0.03] rounded-xl shadow-md p-6 space-y-4">
            <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-amber-500/2 blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-foreground/35">Investor Escrow Pool</h3>
                <div className="text-2xl font-serif font-light text-foreground">
                  ${(idea.fundsGained || 0).toLocaleString()} <span className="text-xs text-foreground/40">gained of ${(idea.investmentNeeded || 25000).toLocaleString()}</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono border-amber-500/30 text-amber-400 bg-amber-500/5 px-3 py-1 rounded-full">
                Institutional Gated
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-foreground/5 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((idea.fundsGained || 0) / (idea.investmentNeeded || 25000)) * 100))}%`, background: "var(--brand-accent)" }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-foreground/30">
                <span>{Math.round(((idea.fundsGained || 0) / (idea.investmentNeeded || 25000)) * 100)}% Gained</span>
                <span>Requires Milestone Releases</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Author & Voting Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 bg-background/10 border-border/[0.03] rounded-xl shadow-md hover:border-border/10 transition-all duration-300">
            <CardContent className="p-6">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-foreground/35 mb-4">Author</h3>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-border/10 shadow">
                  <AvatarImage src={idea.authorAvatar} className="object-cover" />
                  <AvatarFallback className="bg-foreground/5 text-foreground/80 font-bold">{idea.author.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-foreground/90 truncate">{idea.author}</p>
                  <p className="text-[11px] text-foreground/40 truncate mt-0.5">{idea.authorHeadline || "Cohort Founder"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 bg-background/10 border-border/[0.03] rounded-xl shadow-md hover:border-border/10 transition-all duration-300">
            <CardContent className="p-6 flex items-center justify-between gap-4 h-full">
              
              {/* Upvote / Downvote buttons (Replaces single heart toggle) */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-foreground/[0.02] border border-border/10 rounded-lg p-1">
                  <button
                    onClick={() => handleVote("up")}
                    className="hover:text-emerald-400 p-1.5 transition-colors cursor-pointer"
                    aria-label="Upvote"
                  >
                    <ArrowBigUp className="h-5 w-5" />
                  </button>
                  <span className="text-xs font-bold px-2 text-foreground/80 min-w-[20px] text-center">
                    {netScore}
                  </span>
                  <button
                    onClick={() => handleVote("down")}
                    className="hover:text-rose-400 p-1.5 transition-colors cursor-pointer"
                    aria-label="Downvote"
                  >
                    <ArrowBigDown className="h-5 w-5" />
                  </button>
                </div>

                <button
                  onClick={() => setIsFlagModalOpen(true)}
                  disabled={idea.flagged}
                  className={cn(
                    "h-9 px-3 rounded-lg border border-border/10 text-foreground/40 hover:text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer",
                    idea.flagged && "opacity-50 pointer-events-none"
                  )}
                  title="Report or flag this spec"
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>{idea.flagged ? "Flagged" : "Flag"}</span>
                </button>
              </div>

              <Button
                onClick={handleCollaborate}
                disabled={isCollaborating}
                className="h-9 rounded-full bg-foreground text-background hover:bg-brand-accent hover:text-background text-xs font-semibold px-5 transition-all duration-300 cursor-pointer flex items-center gap-1.5"
              >
                {isCollaborating && <Loader2 className="h-3 w-3 animate-spin" />}
                {isCollaborating ? "Sending..." : "Collaborate"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Comments Section (Includes comment insertion form) */}
        <div className="rounded-xl border border-border/[0.03] bg-background/10 p-6 shadow-md hover:border-border/10 transition-all duration-300 space-y-6">
          <h2 className="text-base font-serif font-light text-foreground">
            Comments ({comments.length})
          </h2>

          {/* Comment composer */}
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 border border-border/10 shrink-0">
              <AvatarImage src={userAvatar} className="object-cover" />
              <AvatarFallback className="bg-accent text-xs font-bold">{userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Suggest validation fixes or ask detailed specification questions..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="h-9 bg-accent/20 border-border text-xs rounded-xl flex-1 focus-visible:ring-brand-accent"
              />
              <Button
                onClick={handleAddComment}
                disabled={!commentInput.trim()}
                className="h-9 w-9 rounded-xl bg-primary text-primary-foreground hover:opacity-95 p-0 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Comments list */}
          <div className="space-y-5">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-4">
                  <Avatar className="h-8 w-8 border border-border/10 shrink-0">
                    <AvatarImage src={comment.authorAvatar} className="object-cover" />
                    <AvatarFallback className="bg-foreground/5 text-foreground/70 text-xs font-semibold">{(comment.author || "Anonymous").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="w-full bg-foreground/[0.005] p-3 rounded-xl border border-border/[0.02]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-xs text-foreground/80">{comment.author || "Anonymous"}</p>
                      <p className="text-[11px] font-mono text-foreground/30 uppercase tracking-wide">{comment.timestamp}</p>
                    </div>
                    <p className="text-xs text-foreground/60 leading-relaxed font-sans font-light">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-foreground/30 text-center py-6 font-mono uppercase tracking-widest">No comments yet</p>
            )}
          </div>
        </div>

      </div>

      {/* Flag dialog */}
      {isFlagModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-popover border border-border p-6 rounded-xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-serif text-base font-semibold text-foreground">Complain/Flag Idea</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Help moderate cohort ideas. Surfacing plagiarism or malicious code specifications protects early validation.
            </p>
            <Input
              placeholder="Reason for flag..."
              value={flagReasonText}
              onChange={(e) => setFlagReasonText(e.target.value)}
              className="bg-accent/20 border-border text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setIsFlagModalOpen(false); setFlagReasonText("") }}
                className="h-8 text-xs rounded-lg border-border/60"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleFlagIdea}
                className="h-8 text-xs rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                Submit Flag
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pledge dialog */}
      {isPledgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-popover border border-border p-6 rounded-xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-brand-accent">
              <Coins className="h-5 w-5" />
              <h3 className="font-serif text-base font-semibold text-foreground">Pledge Support</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Support this project with any amount. Every rupee counts. All pledges are held in milestone escrow pools.
            </p>
            
            <form onSubmit={handlePledgeSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 font-mono text-xs">₹</span>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter pledge amount..."
                    value={pledgeInput}
                    onChange={(e) => {
                      setPledgeInput(e.target.value)
                      setCustomPledgeError(null)
                    }}
                    className="pl-7 bg-accent/20 border-border text-xs focus-visible:ring-brand-accent"
                    required
                  />
                </div>
                {customPledgeError && (
                  <p className="text-[10px] text-rose-500 font-mono">{customPledgeError}</p>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[10, 50, 100, 500].map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => {
                      setPledgeInput(preset.toString())
                      setCustomPledgeError(null)
                    }}
                    className="h-8 rounded bg-foreground/5 border border-border/10 text-[11px] font-mono text-foreground/75 hover:bg-brand-accent/20 hover:text-brand-accent hover:border-brand-accent/20 transition-all cursor-pointer"
                  >
                    +₹{preset}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsPledgeModalOpen(false); setPledgeInput(""); setCustomPledgeError(null) }}
                  className="h-8 text-xs rounded-lg border-border/60"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs rounded-lg bg-brand-accent text-background hover:bg-brand-accent hover:text-background"
                >
                  Submit Pledge
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
