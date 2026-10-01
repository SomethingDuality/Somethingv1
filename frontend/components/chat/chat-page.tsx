"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { inbox, type Thread } from "@/lib/inbox-transport"
import { useInbox } from "@/components/community/inbox-provider"
import { ThreadView } from "@/components/chat/thread-view"
import { SkeletonRows } from "@/components/visual/skeleton"
import { when } from "@/lib/format"
import { cn } from "@/lib/utils"

const FILTERS = [
  { id: "all", label: "All" },
  { id: "requests", label: "Requests" },
] as const
type Filter = (typeof FILTERS)[number]["id"]

const statusLabel = (t: Thread) =>
  t.status === "request_in" ? "Request"
  : t.status === "request_out" ? "Waiting for a reply"
  : t.status === "closed" ? "Closed"
  : null

/**
 * Chats (community C5), the same for founders and investors: the list on the left, the
 * conversation on the right (one at a time on phones). `?thread=<id>` opens one, which is where
 * notifications and "Message founder" land. The list refreshes when the shell's inbox poll
 * says something changed.
 */
export function ChatPage({ role }: { role: "founder" | "investor" }) {
  const router = useRouter()
  const params = useSearchParams()
  const selected = params.get("thread")
  const { summary } = useInbox()
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")

  const load = useCallback(async () => {
    try {
      setThreads((await inbox.threads()).threads)
      setError(false)
    } catch {
      setError(true)
      setThreads((cur) => cur ?? [])
    }
  }, [])

  const activity = summary?.chats.lastActivityAt
  useEffect(() => { load() }, [load, activity])

  const open = (id: string | null) => router.replace(id ? `/${role}/chats?thread=${id}` : `/${role}/chats`)
  const onThreadChange = useCallback((t: Thread) => {
    setThreads((cur) => {
      if (!cur) return cur
      return cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? t : x)) : [t, ...cur]
    })
  }, [])

  const requests = threads?.filter((t) => t.status === "request_in") ?? []
  const shown = filter === "requests" ? requests : threads ?? []

  return (
    <div>
      <h1 className="text-[32px] font-normal leading-tight tracking-tight lg:text-[44px]">Chats</h1>
      <div className="mt-8 overflow-hidden rounded-[24px] border border-border lg:grid lg:h-[calc(100dvh-14rem)] lg:min-h-[520px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <section aria-label="Conversations" className={cn("min-h-0 flex-col lg:flex lg:border-r lg:border-border", selected ? "hidden" : "flex")}>
          <div className="flex gap-5 border-b border-border px-5 py-3" role="tablist" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn("text-[15px] transition-colors cursor-pointer", filter === f.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {f.label}{f.id === "requests" && requests.length > 0 && <span className="ml-1.5 tabular-nums">{requests.length}</span>}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads === null ? (
              <div className="p-5"><SkeletonRows /></div>
            ) : error && threads.length === 0 ? (
              <div className="p-5 text-[15px] text-muted-foreground">
                Couldn&apos;t load chats. <button type="button" onClick={load} className="text-foreground underline underline-offset-4 cursor-pointer">Retry</button>
              </div>
            ) : shown.length === 0 ? (
              <p className="p-5 text-[15px] leading-relaxed text-muted-foreground">
                {filter === "requests" ? "No requests waiting." : role === "investor" ? (
                  <>No chats yet. Open any idea in <Link href="/investor/search" className="text-foreground underline underline-offset-4">Discover</Link> and message its founder.</>
                ) : "No chats yet. Investors and founders who write to you about your ideas show up here."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {shown.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => open(t.id)}
                      aria-current={selected === t.id ? "true" : undefined}
                      className={cn("block w-full px-5 py-4 text-left transition-colors cursor-pointer", selected === t.id ? "bg-surface-2" : "hover:bg-surface")}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn("truncate text-[15px]", t.unread > 0 ? "text-foreground" : "text-foreground/85")}>{t.other.name}</span>
                        <span className="shrink-0 text-[13px] text-muted-foreground">{when(t.updatedAt)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                        {t.context.ideaTitle ? <>About &ldquo;{t.context.ideaTitle}&rdquo;</> : " "}
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-3">
                        <span className={cn("truncate text-[13px]", t.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {statusLabel(t) ? <span className="text-gold">{statusLabel(t)} · </span> : null}
                          {t.lastMessage ? `${t.lastMessage.mine ? "You: " : ""}${t.lastMessage.text}` : ""}
                        </span>
                        {t.unread > 0 && <span className="shrink-0 rounded-full bg-foreground px-1.5 text-[13px] leading-5 text-background tabular-nums" aria-label={`${t.unread} unread`}>{t.unread}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-label="Conversation" className={cn("min-h-0", selected ? "flex h-[calc(100dvh-12rem)] flex-col lg:h-auto" : "hidden lg:flex lg:flex-col")}>
          {selected ? (
            <ThreadView key={selected} threadId={selected} role={role} onThreadChange={onThreadChange} onBack={() => open(null)} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-[15px] text-muted-foreground">
              {threads && threads.length > 0 ? "Pick a conversation." : "Your conversations show up here."}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
