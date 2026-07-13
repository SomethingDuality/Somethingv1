"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Send, ChevronLeft, Clock, CheckCheck, MessageSquare, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type User = {
  id: string
  name: string
  avatarInitials: string
  isOnline: boolean
}

type Thread = {
  id: string
  name: string
  lastMessagePreview: string
  unreadCount: number
  participants: User[]
  lastActive: string
  isOnline?: boolean
  isGhostMode?: boolean
}

type Message = {
  id: string
  text: string
  createdAt: string
  sender: Pick<User, "id" | "name">
  deliveryStatus: "sending" | "sent" | "delivered" | "seen"
}

const CURRENT_USER_ID = "user_self_01"

const AVAILABLE_PARTICIPANTS: { id: string; name: string; initials: string }[] = []

// No default threads — all threads come from the API
const DEFAULT_THREADS: Thread[] = []
const DEFAULT_MESSAGES: Record<string, Message[]> = {}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSeconds < 60) return "now"
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`
  return `${Math.floor(diffSeconds / 86400)}d`
}

export default function InvestorChatsPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [text, setText] = useState("")
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState(AVAILABLE_PARTICIPANTS[0].name)

  const handleCreateThread = () => {
    const part = AVAILABLE_PARTICIPANTS.find(p => p.name === selectedParticipant)
    if (!part) return

    const existing = threads.find(t => t.name === part.name)
    if (existing) {
      setActiveId(existing.id)
      setIsNewChatOpen(false)
      return
    }

    const newId = `th-new-${Date.now()}`
    const newThread: Thread = {
      id: newId,
      name: part.name,
      lastMessagePreview: "Conversation started.",
      unreadCount: 0,
      participants: [{ id: part.id, name: part.name.split("•")[0].trim(), avatarInitials: part.initials, isOnline: true }],
      lastActive: new Date().toISOString(),
      isOnline: true,
    }

    const updatedThreads = [newThread, ...threads]
    setThreads(updatedThreads)
    localStorage.setItem("investor_threads", JSON.stringify(updatedThreads))

    const storedMessagesStr = localStorage.getItem("investor_chat_messages")
    const storedMessages = storedMessagesStr ? JSON.parse(storedMessagesStr) : {}
    storedMessages[newId] = [
      {
        id: `m-init-${Date.now()}`,
        sender: { id: part.id, name: part.name.split("•")[0].trim() },
        text: `Hello! Let's coordinate here.`,
        createdAt: new Date().toISOString(),
        deliveryStatus: "seen" as const,
      }
    ]
    localStorage.setItem("investor_chat_messages", JSON.stringify(storedMessages))
    setMessagesByThread(prev => ({ ...prev, [newId]: storedMessages[newId] }))
    setActiveId(newId)
    setIsNewChatOpen(false)
  }

  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Load threads
  useEffect(() => {
    const fetchThreads = async () => {
      setIsLoadingThreads(true)
      setError(null)
      try {
        const response = await axios.get<Thread[]>("/api/chats")
        setThreads(response.data)
        if (response.data.length > 0) {
          const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
          const qActiveId = params?.get("activeId")
          setActiveId(prev => qActiveId || prev || response.data[0].id)
        }
      } catch (err) {
        console.warn("Failed to fetch API chats, loading from localstorage fallback:", err)
        const storedThreads = localStorage.getItem("investor_threads")
        if (storedThreads) {
          try {
            const parsed = JSON.parse(storedThreads)
            setThreads(parsed)
            const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
            const qActiveId = params?.get("activeId")
            if (parsed.length > 0) setActiveId(prev => qActiveId || prev || parsed[0].id)
          } catch {
            setThreads(DEFAULT_THREADS)
            const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
            const qActiveId = params?.get("activeId")
            setActiveId(prev => qActiveId || prev || DEFAULT_THREADS[0].id)
          }
        } else {
          setThreads(DEFAULT_THREADS)
          localStorage.setItem("investor_threads", JSON.stringify(DEFAULT_THREADS))
          const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
          const qActiveId = params?.get("activeId")
          setActiveId(prev => qActiveId || prev || DEFAULT_THREADS[0].id)
        }
      } finally {
        setIsLoadingThreads(false)
      }
    }
    fetchThreads()
  }, [])

  // Clear unreads for selected thread
  useEffect(() => {
    if (!activeId || threads.length === 0) return

    const thread = threads.find(t => t.id === activeId)
    if (thread && thread.unreadCount > 0) {
      const updated = threads.map(t => (t.id === activeId ? { ...t, unreadCount: 0 } : t))
      setThreads(updated)
      localStorage.setItem("investor_threads", JSON.stringify(updated))
    }
  }, [activeId, threads])

  // Load messages
  useEffect(() => {
    if (!activeId) return

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const response = await axios.get<Message[]>(`/api/chats/${activeId}/messages`)
        setMessagesByThread(prev => ({ ...prev, [activeId]: response.data }))
      } catch (err) {
        console.warn(`Failed to fetch API messages for thread ${activeId}, using local fallback:`, err)
        const localMsgKey = `investor_msgs_${activeId}`
        const storedMsgs = localStorage.getItem(localMsgKey)
        if (storedMsgs) {
          try {
            setMessagesByThread(prev => ({ ...prev, [activeId]: JSON.parse(storedMsgs) }))
          } catch {
            setMessagesByThread(prev => ({ ...prev, [activeId]: DEFAULT_MESSAGES[activeId] || [] }))
          }
        } else {
          const defaults = DEFAULT_MESSAGES[activeId] || []
          setMessagesByThread(prev => ({ ...prev, [activeId]: defaults }))
          localStorage.setItem(localMsgKey, JSON.stringify(defaults))
        }
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchMessages()
  }, [activeId])

  const handleRevealIdentity = () => {
    if (!activeId) return
    
    // 1. Update investor threads
    const updatedThreads = threads.map(t => {
      if (t.id === activeId) {
        return { ...t, isGhostMode: false }
      }
      return t
    })
    setThreads(updatedThreads)
    localStorage.setItem("investor_threads", JSON.stringify(updatedThreads))
    
    // 2. Update founder threads
    const founderStored = localStorage.getItem("founder_chat_threads")
    if (founderStored) {
      try {
        const fThreads = JSON.parse(founderStored)
        const investorName = localStorage.getItem("demo_name") || ""
        const updatedFThreads = fThreads.map((t: any) => {
          if (t.id === activeId) {
            return {
              ...t,
              isGhostMode: false,
              name: investorName,
              participants: [t.participants[0], investorName]
            }
          }
          return t
        })
        localStorage.setItem("founder_chat_threads", JSON.stringify(updatedFThreads))
      } catch (e) {
        console.error(e)
      }
    }
    
    // 3. Add system message to investor message store
    const investorDisplayName = localStorage.getItem("demo_name") || "Investor"
    const systemMsg: Message = {
      id: `sys-${Date.now()}`,
      sender: { id: "system", name: "System" },
      text: `📢 You revealed your identity: ${investorDisplayName}`,
      createdAt: new Date().toISOString(),
      deliveryStatus: "seen"
    }
    
    const currentMsgs = messagesByThread[activeId] ?? []
    const updatedMessages = [...currentMsgs, systemMsg]
    setMessagesByThread(prev => ({
      ...prev,
      [activeId]: updatedMessages,
    }))
    localStorage.setItem(`investor_msgs_${activeId}`, JSON.stringify(updatedMessages))
    
    // 4. Add system message to founder's message store
    const founderMsgs = localStorage.getItem("founder_chat_messages")
    if (founderMsgs) {
      try {
        const msgsDb = JSON.parse(founderMsgs)
        const fSystemMsg = {
          id: `sys-${Date.now()}`,
          from: "them",
          text: `📢 Investor revealed their identity: ${investorDisplayName}`,
          when: "Just now",
          timestamp: Date.now(),
          seen: false,
          delivered: true
        }
        msgsDb[activeId] = [...(msgsDb[activeId] ?? []), fSystemMsg]
        localStorage.setItem("founder_chat_messages", JSON.stringify(msgsDb))
      } catch (e) {
        console.error(e)
      }
    }
    
    alert("Identity revealed! The founder can now see your name and profile details.")
    window.dispatchEvent(new CustomEvent("founder-chat-sync"))
  }

  // Send message
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeThread || text.trim().length === 0) return

    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      sender: { id: CURRENT_USER_ID, name: "You" },
      deliveryStatus: "sending",
    }

    const updatedMessages = [...(messagesByThread[activeThread.id] ?? []), optimisticMessage]
    setMessagesByThread(prev => ({
      ...prev,
      [activeThread.id]: updatedMessages,
    }))
    
    // Save to localstorage for fallback consistency
    localStorage.setItem(`investor_msgs_${activeThread.id}`, JSON.stringify(updatedMessages))

    // Update last active in threads list
    const updatedThreads = threads.map(t => {
      if (t.id === activeThread.id) {
        return {
          ...t,
          lastMessagePreview: optimisticMessage.text,
          lastActive: optimisticMessage.createdAt,
          unreadCount: 0
        }
      }
      return t
    })
    setThreads(updatedThreads)
    localStorage.setItem("investor_threads", JSON.stringify(updatedThreads))

    setText("")

    try {
      const response = await axios.post<Message>(`/api/chats/${activeThread.id}/messages`, { text: optimisticMessage.text })
      const savedMessage = response.data

      const finalizedMessages = updatedMessages.map(m => (m.id === optimisticMessage.id ? savedMessage : m))
      setMessagesByThread(prev => ({
        ...prev,
        [activeThread.id]: finalizedMessages,
      }))
      localStorage.setItem(`investor_msgs_${activeThread.id}`, JSON.stringify(finalizedMessages))
    } catch (err) {
      console.warn("Failed API post message, finalizing locally:", err)
      const confirmedMessage: Message = {
        ...optimisticMessage,
        id: `mock_sent_${Date.now()}`,
        deliveryStatus: "delivered"
      }
      const finalizedMessages = updatedMessages.map(m => (m.id === optimisticMessage.id ? confirmedMessage : m))
      setMessagesByThread(prev => ({
        ...prev,
        [activeThread.id]: finalizedMessages,
      }))
      localStorage.setItem(`investor_msgs_${activeThread.id}`, JSON.stringify(finalizedMessages))
    }
  }

  const filteredThreads = useMemo(() => {
    if (!query.trim()) return threads
    const q = query.toLowerCase()
    return threads.filter(t => t.name.toLowerCase().includes(q) || t.lastMessagePreview.toLowerCase().includes(q))
  }, [query, threads])

  const activeThread = filteredThreads.find(t => t.id === activeId)
  const activeMessages = activeThread ? messagesByThread[activeThread.id] ?? [] : []

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
    }
  }, [activeId, activeMessages.length])

  const showOnlyListOnMobile = !activeThread
  const showOnlyChatOnMobile = !!activeThread

  return (
    <div className="w-full pt-6 pb-24 px-6 xl:px-10 space-y-12">
      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-8 lg:gap-10">
        {/* Threads list */}
        <section className={cn("lg:block", showOnlyChatOnMobile ? "hidden" : "block")}>
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-5 flex flex-col h-[600px] lg:h-[700px] shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <Input
                  placeholder="Search conversations..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="h-9 w-full pl-8 bg-accent/30 border-transparent text-foreground placeholder:text-foreground/40 focus:ring-1 focus:ring-[var(--brand-accent)]/30 text-xs rounded-lg"
                />
              </div>
              <Button
                type="button"
                size="icon"
                onClick={() => setIsNewChatOpen(true)}
                className="h-9 w-9 rounded-lg bg-foreground text-background hover:bg-[var(--brand-accent)] hover:text-background shrink-0 cursor-pointer flex items-center justify-center"
                title="New Chat"
              >
                <Plus className="h-4 w-4 text-inherit" />
              </Button>
            </div>

            <div className="space-y-0.5">
              {isLoadingThreads ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-[90px] w-full rounded-lg bg-accent/30" />)
              ) : filteredThreads.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="text-sm text-muted-foreground">No conversations found</div>
                </div>
              ) : (
                filteredThreads.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-3 text-left transition-all duration-200 group border border-transparent",
                      t.id === activeId ? "bg-accent/50 border-border/10 shadow-sm" : "hover:bg-accent/40 active:bg-accent/30",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="grid size-10 place-items-center rounded-full text-xs font-mono font-bold bg-accent/40 text-foreground">
                          {t.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                        </div>
                        {t.isOnline && <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-background" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="truncate text-xs font-semibold text-foreground/90">{t.name}</span>
                          <div className="flex items-center gap-1.5 ml-2">
                            {t.unreadCount > 0 && (
                              <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[11px] font-bold bg-[var(--brand-accent)] text-background rounded-full">{t.unreadCount}</span>
                            )}
                            <span className="text-[11px] font-mono text-foreground/40 whitespace-nowrap">{formatTime(t.lastActive)}</span>
                          </div>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{t.lastMessagePreview}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Chat view */}
        <section className={cn("lg:block", showOnlyListOnMobile ? "hidden" : "block")}>
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl overflow-hidden flex flex-col h-[600px] lg:h-[700px] shadow-md">
            {/* Header */}
            <div className="flex h-14 items-center gap-3 px-3 sm:px-4 border-b border-border/40 bg-sidebar/10">
              <button className="lg:hidden" onClick={() => setActiveId(null)}><ChevronLeft className="h-5 w-5" /></button>
              {activeThread ? (
                <div className="truncate text-xs font-semibold uppercase tracking-wider font-mono text-foreground/80 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" />
                  {activeThread.name}
                </div>
              ) : (
                <div className="px-2 text-sm text-foreground/75 font-mono uppercase tracking-wider text-xs">Sync Channel</div>
              )}
            </div>

            {/* Ghost Mode Status Banner */}
            {activeThread && activeThread.isGhostMode && (
              <div className="bg-amber-500/10 border-b border-amber-500/15 px-4 py-2 flex items-center justify-between text-xs text-amber-400 font-mono shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Ghost Mode Active — anonymized to the founder.
                </span>
                <Button 
                  onClick={handleRevealIdentity}
                  className="h-6 rounded bg-amber-500 text-black border-transparent font-medium hover:bg-amber-400 text-[11px] px-2.5 cursor-pointer flex items-center justify-center shrink-0"
                >
                  Reveal Identity
                </Button>
              </div>
            )}

            {/* Messages area */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-background/10">
              {isLoadingMessages ? (
                <div className="grid h-full place-items-center">
                  <Loader2 className="animate-spin size-6 text-foreground/40" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div className="space-y-1.5">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/35 mx-auto" />
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">No messages yet</p>
                  </div>
                </div>
              ) : (
                activeMessages.map((m, i) => {
                  const isYou = m.sender.id === CURRENT_USER_ID
                  const lastMessage = i === activeMessages.length - 1
                  return (
                    <div key={m.id} className={cn("flex w-full", isYou ? "justify-end" : "justify-start")}>
                      <div className="max-w-[85%] sm:max-w-[78%]">
                        <div className={cn("rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm", isYou ? "bg-primary text-primary-foreground rounded-br-md" : "bg-accent text-foreground rounded-bl-md")}>
                          <p>{m.text}</p>
                        </div>
                        <div className={cn("flex items-center gap-1 mt-1.5 text-[11px] font-mono", isYou ? "justify-end text-foreground/45" : "text-foreground/45")}>
                          <span>{formatTime(m.createdAt)}</span>
                          {isYou && lastMessage && (
                            m.deliveryStatus === "seen" ? <CheckCheck className="h-3 w-3 text-blue-400" /> :
                            m.deliveryStatus === "delivered" ? <CheckCheck className="h-3 w-3 text-foreground/40" /> :
                            <Clock className="h-3 w-3 text-foreground/30" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Input area */}
            <form onSubmit={onSend} className="flex items-end gap-2 p-3 border-t border-border/40 bg-sidebar/5">
              <textarea
                ref={inputRef}
                placeholder={activeThread ? "Type a message..." : "Select a conversation to start"}
                disabled={!activeThread || isLoadingMessages}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) onSend(e); }}
                className="w-full min-h-[40px] max-h-[120px] py-2.5 px-3 rounded-2xl bg-accent/30 border-transparent text-xs text-foreground placeholder:text-foreground/40 focus:ring-1 focus:ring-[var(--brand-accent)]/30 resize-none focus:outline-none"
                rows={1}
              />
              <Button type="submit" size="icon" disabled={!activeThread || text.trim().length === 0} className="size-10 rounded-full flex-shrink-0 bg-primary text-primary-foreground enabled:hover:opacity-90 disabled:opacity-30 cursor-pointer">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </section>
      </div>

      {/* New Chat Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="bg-popover/95 backdrop-blur-2xl border border-border/[0.08] text-foreground rounded-2xl max-w-md shadow-2xl p-6">
          <DialogHeader className="border-b border-border/5 pb-3">
            <DialogTitle className="text-lg font-serif font-light text-foreground">
              Start a New Chat
            </DialogTitle>
            <DialogDescription className="text-foreground/45 text-xs mt-1">
              Select a participant from the directory to start a new sync conversation thread.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label htmlFor="participant-select" className="text-[11px] text-foreground/50 font-semibold uppercase tracking-wider font-mono block">
                Select Contact
              </label>
              <select
                id="participant-select"
                value={selectedParticipant}
                onChange={(e) => setSelectedParticipant(e.target.value)}
                className="w-full h-9 rounded-lg bg-background/50 border border-border/20 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)] focus:border-[var(--brand-accent)] cursor-pointer font-sans"
              >
                {AVAILABLE_PARTICIPANTS.map((p) => (
                  <option key={p.name} value={p.name} className="bg-[#0c0d0f]">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewChatOpen(false)}
              className="border-border/10 text-foreground hover:bg-foreground/5 text-xs font-semibold rounded-lg h-8 px-4 bg-transparent cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateThread}
              className="bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold h-8 px-4 rounded-lg cursor-pointer"
            >
              Start Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
