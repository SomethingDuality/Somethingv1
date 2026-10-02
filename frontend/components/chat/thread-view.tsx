"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUp } from "lucide-react"
import { inbox, newClientId, type Message, type Thread } from "@/lib/inbox-transport"
import { useInbox } from "@/components/community/inbox-provider"
import { ReportButton } from "@/components/community/report-dialog"
import { RevealDialog } from "@/components/chat/reveal-dialog"
import { InviteDialog } from "@/components/chat/invite-dialog"
import { quietLinkClass } from "@/components/shell/page"
import { toast } from "@/components/ui/use-toast"
import { usePoll } from "@/hooks/use-poll"
import { when } from "@/lib/format"
import { apiError, cn } from "@/lib/utils"

type Pending = { clientId: string; text: string; failed: boolean }

const MESSAGES_POLL_MS = 4_000

/** One conversation: who it's with, the request or Ghost Mode banner, the messages, the composer. */
export function ThreadView({ threadId, role, onThreadChange, onBack }: {
  threadId: string
  role: "founder" | "investor"
  onThreadChange: (t: Thread) => void
  onBack: () => void
}) {
  const { refresh: refreshInbox } = useInbox()
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [pending, setPending] = useState<Pending[]>([])
  const [text, setText] = useState("")
  const [revealOpen, setRevealOpen] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  // The poll cursor: the time of the newest message a fetch returned. Never our own send's time:
  // the server overlaps `after` by only 2 s, so a reply they sent just before ours would be skipped.
  const lastAt = useRef<string | undefined>(undefined)
  const openId = useRef(threadId)
  openId.current = threadId

  const update = useCallback((t: Thread) => {
    setThread(t)
    onThreadChange(t)
  }, [onThreadChange])

  const markRead = useCallback(async () => {
    try {
      await inbox.read(threadId)
      refreshInbox().catch(() => {})
    } catch {
      // Unread counts catch up on the next poll.
    }
  }, [threadId, refreshInbox])

  // Open a thread: load it and its messages, and mark it read.
  useEffect(() => {
    let live = true
    setThread(null)
    setMessages(null)
    setMissing(false)
    setPending([])
    lastAt.current = undefined
    Promise.all([inbox.thread(threadId), inbox.messages(threadId)])
      .then(([t, ms]) => {
        if (!live) return
        update({ ...t, unread: 0 })
        setMessages(ms)
        lastAt.current = ms.at(-1)?.at
        markRead()
      })
      .catch(() => { if (live) setMissing(true) })
    return () => { live = false }
  }, [threadId, update, markRead])

  // New messages every 4 s while the chat is open and the tab is visible.
  usePoll(async () => {
    if (!messages) return
    const fresh = await inbox.messages(threadId, lastAt.current)
    if (openId.current !== threadId) return // another chat was opened meanwhile
    lastAt.current = fresh.at(-1)?.at ?? lastAt.current
    // The overlap returns some messages twice (and ours, already shown): keep one of each id.
    const known = new Set(messages.map((m) => m.id))
    const added = fresh.filter((m) => !known.has(m.id))
    if (!added.length) return
    setMessages((cur) => [...(cur ?? []), ...added.filter((m) => !(cur ?? []).some((c) => c.id === m.id))])
    // Something new from them can change the thread too (a reply accepts a request).
    update({ ...(await inbox.thread(threadId)), unread: 0 })
    markRead()
  }, MESSAGES_POLL_MS, { enabled: Boolean(messages) })

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages, pending])

  // The composer grows with the text, up to a limit.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const deliver = async (p: Pending) => {
    setPending((cur) => cur.map((x) => (x.clientId === p.clientId ? { ...x, failed: false } : x)))
    try {
      const out = await inbox.send(threadId, p.text, p.clientId)
      setPending((cur) => cur.filter((x) => x.clientId !== p.clientId))
      setMessages((cur) => (cur?.some((m) => m.id === out.message.id) ? cur : [...(cur ?? []), out.message]))
      update(out.thread)
    } catch (err) {
      setPending((cur) => cur.map((x) => (x.clientId === p.clientId ? { ...x, failed: true } : x)))
      toast({ title: "Not sent", description: apiError(err, "Tap Retry to send it again."), variant: "destructive" })
    }
  }

  const send = () => {
    const body = text.trim()
    if (!body || !thread?.canSend) return
    const p = { clientId: newClientId(), text: body, failed: false }
    setPending((cur) => [...cur, p])
    setText("")
    deliver(p)
  }

  const act = async (fn: () => Promise<Thread>, done?: string) => {
    setBusy(true)
    try {
      update(await fn())
      if (done) toast({ title: done })
      refreshInbox().catch(() => {})
      const ms = await inbox.messages(threadId)
      setMessages(ms)
      lastAt.current = ms.at(-1)?.at
    } catch (err) {
      toast({ title: "That didn't work", description: apiError(err, "Please try again."), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (missing) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-4 p-8">
        <p className="text-[15px] text-muted-foreground">This chat isn&apos;t available.</p>
        <button type="button" onClick={onBack} className={quietLinkClass}>Back to chats</button>
      </div>
    )
  }
  if (!thread || !messages) {
    return <div className="flex h-full items-center justify-center p-8 text-[15px] text-muted-foreground">Loading…</div>
  }

  const ideaHref = thread.context.ideaId
    ? role === "investor" ? `/investor/search/${thread.context.ideaId}` : `/founder/ideas/${thread.context.ideaId}`
    : null
  const asks = thread.kind === "founder_founder" ? "asked to join" : "wants to talk about"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-2 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer lg:hidden">
            ← Chats
          </button>
          <p className="truncate text-lg leading-tight">
            {thread.other.name}
            {thread.other.firm && <span className="text-muted-foreground">, {thread.other.firm}</span>}
          </p>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">
            {thread.other.ghost ? thread.other.hint : thread.other.role === "Investor" ? "Investor" : "Founder"}
            {thread.context.ideaTitle && (
              <> · about {ideaHref ? <Link href={ideaHref} className="text-foreground underline-offset-4 hover:underline">&ldquo;{thread.context.ideaTitle}&rdquo;</Link> : <>&ldquo;{thread.context.ideaTitle}&rdquo;</>}</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 pt-1 text-[13px]">
          {thread.canInvite && (
            <button type="button" onClick={() => setInviteOpen(true)} className="text-foreground underline underline-offset-4 cursor-pointer">Invite to team</button>
          )}
          {thread.me.canReveal && (
            <button type="button" onClick={() => setRevealOpen(true)} className="text-foreground underline underline-offset-4 cursor-pointer">Share my name</button>
          )}
          {thread.status !== "closed" && (confirmBlock ? (
            <span className="inline-flex items-center gap-3">
              Block?
              <button type="button" disabled={busy} onClick={() => act(() => inbox.block(threadId), "Blocked")} className="text-foreground underline underline-offset-4 cursor-pointer">Block</button>
              <button type="button" onClick={() => setConfirmBlock(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmBlock(true)} className="text-muted-foreground hover:text-foreground cursor-pointer">Block</button>
          ))}
        </div>
      </header>

      {thread.me.ghost && (
        <p className="border-b border-border bg-surface px-5 py-3 text-[13px] leading-relaxed text-muted-foreground">
          You&apos;re in Ghost Mode here: they see &ldquo;Ghost investor&rdquo; and the stages you invest in, not your name.
          Committing money shares your name.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6" aria-live="polite">
        <ol className="space-y-3">
          {messages.map((m) => m.kind === "event" ? (
            <li key={m.id} className="py-2 text-center text-[13px] text-muted-foreground">{m.text}</li>
          ) : (
            <li key={m.id} className={cn("group flex flex-col", m.mine ? "items-end" : "items-start")}>
              <p className={cn(
                "max-w-[80%] whitespace-pre-line break-words rounded-[20px] px-4 py-2.5 text-[15px] leading-relaxed",
                m.mine ? "rounded-br-md bg-surface-2 text-foreground" : "rounded-bl-md border border-line text-foreground",
              )}>
                {m.text}
              </p>
              <span className="mt-1 flex items-center gap-3 px-1 text-[13px] text-muted-foreground">
                {when(m.at)}
                {!m.mine && <ReportButton type="message" id={m.id} className="text-[13px] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" />}
              </span>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.clientId} className="flex flex-col items-end">
              <p className={cn("max-w-[80%] whitespace-pre-line break-words rounded-[20px] rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed", p.failed ? "text-muted-foreground" : "opacity-60")}>
                {p.text}
              </p>
              <span className="mt-1 px-1 text-[13px] text-muted-foreground">
                {p.failed ? (
                  <>Not sent · <button type="button" onClick={() => deliver(p)} className="text-foreground underline underline-offset-4 cursor-pointer">Retry</button></>
                ) : "Sending…"}
              </span>
            </li>
          ))}
        </ol>
        <div ref={endRef} />
      </div>

      {thread.status === "request_in" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3">
          <p className="text-[13px] text-muted-foreground">{thread.other.name} {asks} &ldquo;{thread.context.ideaTitle}&rdquo;. Reply to accept, or:</p>
          <div className="flex items-center gap-4 text-[13px]">
            <button type="button" disabled={busy} onClick={() => act(() => inbox.accept(threadId), "Accepted")} className="text-foreground underline underline-offset-4 cursor-pointer">Accept</button>
            <button type="button" disabled={busy} onClick={() => act(() => inbox.decline(threadId))} className="text-muted-foreground hover:text-foreground cursor-pointer">Decline</button>
          </div>
        </div>
      )}

      <div className="border-t border-border p-4">
        {thread.canSend ? (
          <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-end gap-2 rounded-[24px] border border-line bg-surface py-1.5 pl-4 pr-1.5 focus-within:border-muted-foreground/60">
            <textarea
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1}
              aria-label="Message"
              placeholder={thread.status === "request_in" ? "Reply to accept" : "Write a message"}
              className="block min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[15px]"
            />
            <button type="submit" disabled={!text.trim()} aria-label="Send" className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed">
              <ArrowUp className="size-4" />
            </button>
          </form>
        ) : (
          <p className="px-1 text-[13px] text-muted-foreground">{thread.reason}</p>
        )}
      </div>

      {thread.canInvite && (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          threadId={threadId}
          name={thread.other.name}
          ideaTitle={thread.context.ideaTitle}
          onSent={() => act(() => inbox.thread(threadId), "Invite sent")}
        />
      )}

      <RevealDialog
        open={revealOpen}
        onOpenChange={setRevealOpen}
        otherName={thread.other.name}
        busy={revealing}
        onConfirm={async () => {
          setRevealing(true)
          await act(() => inbox.reveal(threadId), "Your name is shared in this chat")
          setRevealing(false)
          setRevealOpen(false)
        }}
      />
    </div>
  )
}
