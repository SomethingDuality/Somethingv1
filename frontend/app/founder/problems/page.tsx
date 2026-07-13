"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  ArrowBigUp, ArrowBigDown, MessageSquare, AlertTriangle,
  Plus, Search, HelpCircle, EyeOff, Flag, Send, TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface Comment {
  id: string
  author: string
  handle: string
  avatarUrl?: string
  text: string
  createdAt: string
  flagged?: boolean
}

interface Problem {
  id: string
  author: string
  handle: string
  avatarUrl?: string
  text: string
  tags: string[]
  createdAt: string
  upvotes: number
  downvotes: number
  comments: Comment[]
  flagged?: boolean
  flagReason?: string
}

const DEFAULT_PROBLEMS: Problem[] = []

export default function FounderProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [newText, setNewText] = useState("")
  const [newTags, setNewTags] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // Current user info
  const [userName, setUserName] = useState("")
  const [userAvatar, setUserAvatar] = useState("")

  // Interaction states
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({})
  const [flagModalId, setFlagModalId] = useState<string | null>(null)
  const [flagReasonText, setFlagReasonText] = useState("")

  // Load profile + problems list
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

      // Load problems from localstorage
      const storedProbs = localStorage.getItem("problems_list")
      if (storedProbs) {
        try {
          setProblems(JSON.parse(storedProbs))
        } catch {
          setProblems(DEFAULT_PROBLEMS)
        }
      } else {
        setProblems(DEFAULT_PROBLEMS)
        localStorage.setItem("problems_list", JSON.stringify(DEFAULT_PROBLEMS))
      }
    }
  }, [])

  const saveProblems = (updated: Problem[]) => {
    setProblems(updated)
    localStorage.setItem("problems_list", JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent("problems-updated"))
  }

  const handlePostProblem = () => {
    if (!newText.trim()) return
    const tagsArr = newTags
      .split(",")
      .map(t => t.trim().replace("#", ""))
      .filter(t => t.length > 0)

    const newProblem: Problem = {
      id: `prob-${Date.now()}`,
      author: userName,
      handle: `@${userName.toLowerCase().replace(/\s+/g, "_")}`,
      avatarUrl: userAvatar,
      text: newText,
      tags: tagsArr.length > 0 ? tagsArr : ["general"],
      createdAt: "Just now",
      upvotes: 1,
      downvotes: 0,
      comments: []
    }

    const updated = [newProblem, ...problems]
    saveProblems(updated)
    setNewText("")
    setNewTags("")
  }

  const handleVote = (id: string, dir: "up" | "down") => {
    const updated = problems.map(p => {
      if (p.id !== id) return p
      // Store voted status in local storage to prevent duplicate votes
      const voteKey = `vote_${id}`
      const prevVote = localStorage.getItem(voteKey)

      let upDelta = 0
      let downDelta = 0

      if (dir === "up") {
        if (prevVote === "up") {
          // undo upvote
          upDelta = -1
          localStorage.removeItem(voteKey)
        } else if (prevVote === "down") {
          // swap from down to up
          upDelta = 1
          downDelta = -1
          localStorage.setItem(voteKey, "up")
        } else {
          // fresh upvote
          upDelta = 1
          localStorage.setItem(voteKey, "up")
        }
      } else {
        if (prevVote === "down") {
          // undo downvote
          downDelta = -1
          localStorage.removeItem(voteKey)
        } else if (prevVote === "up") {
          // swap from up to down
          downDelta = 1
          upDelta = -1
          localStorage.setItem(voteKey, "down")
        } else {
          // fresh downvote
          downDelta = 1
          localStorage.setItem(voteKey, "down")
        }
      }

      return {
        ...p,
        upvotes: Math.max(0, p.upvotes + upDelta),
        downvotes: Math.max(0, p.downvotes + downDelta)
      }
    })
    saveProblems(updated)
  }

  const handleAddComment = (probId: string) => {
    const txt = commentText[probId]
    if (!txt || !txt.trim()) return

    const newComment: Comment = {
      id: `c-${Date.now()}`,
      author: userName,
      handle: `@${userName.toLowerCase().replace(/\s+/g, "_")}`,
      avatarUrl: userAvatar,
      text: txt,
      createdAt: "Just now"
    }

    const updated = problems.map(p => {
      if (p.id === probId) {
        return {
          ...p,
          comments: [...p.comments, newComment]
        }
      }
      return p
    })

    saveProblems(updated)
    setCommentText(prev => ({ ...prev, [probId]: "" }))
  }

  const handleFlagProblem = (probId: string) => {
    const updated = problems.map(p => {
      if (p.id === probId) {
        return {
          ...p,
          flagged: true,
          flagReason: flagReasonText || "Flagged by community review"
        }
      }
      return p
    })
    saveProblems(updated)
    setFlagModalId(null)
    setFlagReasonText("")
  }

  // Get active tags
  const allTags = Array.from(new Set(problems.flatMap(p => p.tags)))

  const filtered = problems.filter(p => {
    const textMatches = p.text.toLowerCase().includes(searchQuery.toLowerCase()) || p.author.toLowerCase().includes(searchQuery.toLowerCase())
    const tagMatches = !selectedTag || p.tags.includes(selectedTag)
    return textMatches && tagMatches
  })

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12 relative">
      
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-12 left-1/4 w-[400px] h-[400px] rounded-full bg-[#34D399]/[0.02] blur-[100px] z-0" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#8EA38E]/[0.02] blur-[100px] z-0" />

      {/* Header */}
      <div className="space-y-1.5 pb-3 border-b border-border/40 relative z-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#34D399] flex items-center gap-2 font-bold">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34D399] animate-pulse" />
          Friction Telemetry Feed
        </p>
        <h1 className="text-3xl font-serif font-light tracking-tight text-foreground leading-tight">
          Problems Board
        </h1>
        <p className="text-xs text-muted-foreground font-sans max-w-lg mt-0.5">
          Post and upvote developer roadblocks. No pitch decks, just real-world problems worth solving.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 sm:gap-12 items-start">
        
        {/* Main Feed Column */}
        <div className="md:col-span-8 space-y-6">
          
          {/* Post/Compose Card (Twitter-style box) */}
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 space-y-4 shadow-sm hover:border-border/60 transition duration-300">
            <div className="flex gap-4">
              <Avatar className="h-9 w-9 border border-border/40 shrink-0">
                <AvatarImage src={userAvatar} className="object-cover" />
                <AvatarFallback className="bg-accent text-[11px] font-bold">{userName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea
                  placeholder="What technical problem or market friction are you facing?"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value.slice(0, 280))}
                  className="bg-muted/15 border border-border/20 focus-visible:ring-1 focus-visible:ring-[var(--brand-accent)]/20 focus-visible:border-[var(--brand-accent)]/30 p-3 text-xs sm:text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/45 resize-none min-h-[80px] font-sans font-light rounded-xl"
                />
                
                {/* Character Counter */}
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <Input
                    placeholder="Add tags (comma separated, e.g. SQLite, Hardware)"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="h-8 w-2/3 bg-muted/10 border-border/40 focus-visible:ring-0 text-[11px] placeholder:text-muted-foreground/40 rounded-lg text-foreground"
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-muted-foreground/55">
                      {280 - newText.length}
                    </span>
                    <Button
                      onClick={handlePostProblem}
                      disabled={!newText.trim()}
                      className="h-8 text-[11px] font-mono uppercase tracking-wider px-4 rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 cursor-pointer transition font-bold"
                    >
                      Post Friction
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search problems */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <Input
              placeholder="Search problems, handles, or tag details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-muted/10 border-border/40 text-xs rounded-xl text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-[#34D399]/30 focus-visible:border-[#34D399]/40"
            />
          </div>

          {/* Feed List */}
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground font-mono border border-dashed border-border/60 rounded-xl">
                No problems posted yet. Be the first to surface friction!
              </div>
            ) : (
              filtered.map(p => (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-8 transition-all duration-300 space-y-6 hover:border-border/35 hover:bg-card/15 hover:shadow-md relative overflow-hidden",
                    p.flagged && "opacity-60 border-rose-500/10 bg-rose-500/[0.005]"
                  )}
                >
                  <div className="flex justify-between gap-3">
                    <div className="flex gap-3">
                      <Avatar className="h-9 w-9 border border-border/40 shrink-0 shadow-sm">
                        {p.avatarUrl ? (
                          <AvatarImage src={p.avatarUrl} className="object-cover" />
                        ) : null}
                        <AvatarFallback className="bg-accent text-[11px] font-bold">{p.author.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground/90 leading-none">{p.author}</span>
                          <span className="text-[10px] text-muted-foreground/70 font-mono">{p.handle}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/50 font-mono mt-1">{p.createdAt}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {p.flagged ? (
                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-mono px-2 py-0.5">
                          FLAGGED: REVIEW PENDING
                        </Badge>
                      ) : (
                        <button
                          onClick={() => setFlagModalId(p.id)}
                          className="h-6 w-6 text-muted-foreground/50 hover:text-rose-400 rounded-full hover:bg-rose-500/10 flex items-center justify-center cursor-pointer transition-colors"
                          title="Report/complain problem"
                        >
                          <Flag className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-[13px] text-foreground/80 leading-relaxed font-sans font-light">
                    {p.text}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map(t => (
                      <Badge key={t} className="bg-muted/30 text-muted-foreground/80 border border-border/30 hover:bg-muted/55 transition text-[9px] font-mono px-2 py-0.5 cursor-pointer">
                        #{t}
                      </Badge>
                    ))}
                  </div>

                  {/* Vote & Comment Actions */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3.5">
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground/60">
                      {/* Voting Pill */}
                      <div className="flex items-center gap-1 bg-muted/20 border border-border/40 rounded-full p-1 shadow-inner">
                        <button
                          onClick={() => handleVote(p.id, "up")}
                          className="hover:text-emerald-400 p-0.5 cursor-pointer transition-colors"
                          aria-label="Upvote"
                        >
                          <ArrowBigUp className="h-4.5 w-4.5" />
                        </button>
                        <span className="text-[10px] font-bold text-foreground/75 min-w-[14px] text-center">
                          {p.upvotes - p.downvotes}
                        </span>
                        <button
                          onClick={() => handleVote(p.id, "down")}
                          className="hover:text-rose-400 p-0.5 cursor-pointer transition-colors"
                          aria-label="Downvote"
                        >
                          <ArrowBigDown className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      {/* Comments count */}
                      <button
                        onClick={() => setOpenCommentsId(openCommentsId === p.id ? null : p.id)}
                        className="flex items-center gap-1.5 hover:text-[#34D399] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{p.comments.length}</span>
                      </button>
                    </div>

                    <Button
                      variant="ghost"
                      onClick={() => setOpenCommentsId(openCommentsId === p.id ? null : p.id)}
                      className="h-8 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/10 px-3 transition cursor-pointer"
                    >
                      {openCommentsId === p.id ? "Hide Replies" : "View Replies"}
                    </Button>
                  </div>

                  {/* Expandable Comments/Replies Section */}
                  {openCommentsId === p.id && (
                    <div className="border-t border-border/40 pt-4 space-y-4 animate-fade-in">
                      
                      {/* Add Comment input */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a comment or solution path..."
                          value={commentText[p.id] || ""}
                          onChange={(e) => setCommentText(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="h-8 bg-muted/10 border-border/40 text-xs flex-1 rounded-lg text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-1 focus-visible:ring-[#34D399]/30 focus-visible:border-[#34D399]/40"
                        />
                        <Button
                          size="icon"
                          onClick={() => handleAddComment(p.id)}
                          className="h-8 w-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Comments list */}
                      <div className="space-y-3 pl-3 border-l border-border/10">
                        {p.comments.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest py-2">No replies yet.</p>
                        ) : (
                          p.comments.map(c => (
                            <div key={c.id} className="space-y-1 bg-foreground/[0.005] p-2.5 rounded-lg border border-border/[0.02]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-[11px] text-foreground/80">{c.author}</span>
                                  <span className="text-[9px] text-muted-foreground font-mono">{c.handle}</span>
                                </div>
                                <span className="text-[8px] text-muted-foreground font-mono">{c.createdAt}</span>
                              </div>
                              <p className="text-xs text-foreground/60 leading-relaxed font-sans">{c.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>

        </div>

        {/* Sidebar Facet Column */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Active Tags list */}
          <Card className="bg-card/60 border-border/40 backdrop-blur-xl shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#34D399] pb-2 border-b border-border/40">
                Trending Roadblocks
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={cn(
                    "text-[10px] font-mono rounded-full px-2.5 py-1 border transition-all cursor-pointer",
                    !selectedTag
                      ? "border-[#34D399]/30 bg-[#34D399]/10 text-foreground"
                      : "border-border/40 bg-muted/10 text-muted-foreground/85 hover:bg-muted/20 hover:text-foreground"
                  )}
                >
                  #all
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={cn(
                      "text-[10px] font-mono rounded-full px-2.5 py-1 border transition-all cursor-pointer",
                      selectedTag === tag
                        ? "border-[#34D399]/30 bg-[#34D399]/10 text-foreground"
                        : "border-border/40 bg-muted/10 text-muted-foreground/85 hover:bg-muted/20 hover:text-foreground"
                    )}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Market Signal Analytics (Business Model Doc Validation Signal) */}
          <Card className="bg-card/60 border-border/40 backdrop-blur-xl shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[#34D399] flex items-center gap-1.5 pb-2 border-b border-border/40">
                <TrendingUp className="h-3.5 w-3.5 text-[#34D399]" />
                Market Validation Signal
              </h3>
              <p className="text-[10px] text-muted-foreground/70 leading-normal font-sans font-light">
                Real-time upvote velocity and crowd attention across active roadblock sectors.
              </p>
              <div className="space-y-3 pt-1">
                {[
                  { tag: "CRDTs & SQLite Sync",   pct: 42, color: "#8EA38E" },
                  { tag: "Shenzhen Supply-Chain",  pct: 28, color: "#C88E72" },
                  { tag: "Edge Hardware Logistics", pct: 15, color: "#8293A4" },
                  { tag: "P2P History Pruning",   pct: 10, color: "#E2DFD5" }
                ].map((stat) => (
                  <div key={stat.tag} className="space-y-1">
                    <div className="flex justify-between items-baseline text-[9px] font-mono">
                      <span className="text-foreground/85">{stat.tag}</span>
                      <span className="font-bold text-muted-foreground">{stat.pct}% velocity</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${stat.pct}%`, backgroundColor: stat.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Guidelines */}
          <Card className="bg-card/60 border-border/40 backdrop-blur-xl shadow-sm rounded-2xl">
            <CardContent className="p-5 text-[11px] text-muted-foreground/80 space-y-3 leading-relaxed font-sans font-light">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/40">
                Friction Criteria
              </h3>
              <p>Surfacing roadblock data creates high-conviction deal matches. Investors view active issues to understand validation difficulty.</p>
              <ul className="list-disc pl-4 space-y-1 font-mono text-[10px] text-muted-foreground/70">
                <li>Zero elevator pitches</li>
                <li>Character limit of 280</li>
                <li>Upvotes drive priority scoring</li>
              </ul>
            </CardContent>
          </Card>

        </div>

      </div>

      {/* Complain/Flag Dialog */}
      {flagModalId && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-background border border-border p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-serif text-base font-semibold text-foreground">Complain/Flag Post</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-light font-sans">
              Help moderate the community feed. Please provide details of the violation (e.g. spam, plagiarism, offensive language).
            </p>
            <Input
              placeholder="Reason for flag..."
              value={flagReasonText}
              onChange={(e) => setFlagReasonText(e.target.value)}
              className="bg-muted/10 border-border/40 text-xs text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-rose-500/30"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFlagModalId(null); setFlagReasonText("") }}
                className="h-8 text-xs font-mono uppercase tracking-wider rounded-lg border-border/40 text-muted-foreground hover:bg-muted/10"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleFlagProblem(flagModalId)}
                className="h-8 text-xs font-mono uppercase tracking-wider rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                Submit Flag
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
