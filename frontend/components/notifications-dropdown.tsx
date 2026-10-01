"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { useInbox } from "@/components/community/inbox-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { apiError, cn } from "@/lib/utils"
import { when } from "@/lib/format"

interface Notification {
  id: string
  text: string
  timestamp: string
  read: boolean
  /** The page it opens, e.g. the idea it is about. */
  link?: string | null
}



/**
 * The sidebar's "Notifications" row and its list. Server data only: if the request fails the
 * list says so (it used to fall back to a browser copy and look current).
 * Unread ones are counted on the row and shown in full colour; opening one marks it read and
 * goes to the page it is about. "Clear all" deletes them. The shell's inbox poll (every 20 s
 * while the tab is visible) tells it when the unread count changed; only then it reloads.
 */
export function NotificationsDropdown() {
  const router = useRouter()
  // Beside the sidebar on laptops; above the row in the phone menu, where there's no room beside it.
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const unreadRef = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<Notification[]>("/notifications")
      setItems(res.data)
    } catch (err) {
      setError(apiError(err, "Couldn't load notifications."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const unread = items.filter((n) => !n.read).length
  unreadRef.current = unread

  const { summary } = useInbox()
  const serverUnread = summary?.notifications.unread
  useEffect(() => {
    if (serverUnread !== undefined && serverUnread !== unreadRef.current) load()
  }, [serverUnread, load])

  const openItem = (n: Notification) => {
    if (!n.read) markRead(n.id)
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  const markRead = async (id: string) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await apiClient.post(`/notifications/mark-read/${id}`, {})
    } catch {
      // Not worth interrupting for: it shows as unread again on the next load.
    }
  }

  const markAllRead = async () => {
    try {
      await apiClient.post("/notifications/mark-all-read", {})
      setItems((list) => list.map((n) => ({ ...n, read: true })))
    } catch (err) {
      setError(apiError(err, "Couldn't mark notifications read."))
    }
  }

  const clearAll = async () => {
    try {
      await apiClient.delete("/notifications")
      setItems([])
    } catch (err) {
      setError(apiError(err, "Couldn't clear notifications."))
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load() }}>
      <PopoverTrigger className="flex w-full items-center justify-between py-1.5 text-[15px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <span>Notifications</span>
        {unread > 0 && <span className="text-foreground tabular-nums" aria-label={`${unread} unread`}>{unread}</span>}
      </PopoverTrigger>
      <PopoverContent
        side={isMobile ? "top" : "right"}
        align={isMobile ? "start" : "end"}
        sideOffset={isMobile ? 8 : 16}
        collisionPadding={16}
        className="w-[min(20rem,calc(100vw-2rem))] p-0 bg-popover border-border rounded-xl"
      >
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="px-3 py-4 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <button type="button" onClick={load} className="text-sm underline underline-offset-4 cursor-pointer">Retry</button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn("w-full rounded-lg px-3 py-3 text-left transition-colors", n.read && !n.link ? "cursor-default" : "cursor-pointer hover:bg-surface-2")}
                  >
                    <p className={cn("text-sm leading-snug", n.read ? "text-muted-foreground" : "text-foreground")}>{n.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {when(n.timestamp)}
                      {!n.read && <span className="sr-only">, unread</span>}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex gap-5 border-t border-border px-5 py-3 text-sm">
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-muted-foreground hover:text-foreground cursor-pointer">
                Mark all read
              </button>
            )}
            <button type="button" onClick={clearAll} className="text-muted-foreground hover:text-foreground cursor-pointer">
              Clear all
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
