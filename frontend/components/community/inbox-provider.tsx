"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { inbox, type InboxSummary, type Notification } from "@/lib/inbox-transport"
import { usePoll } from "@/hooks/use-poll"
import { purgeLegacyStorage } from "@/lib/local-keys"
import { apiError } from "@/lib/utils"

type InboxContext = { summary: InboxSummary | null; refresh: () => Promise<void> }

export type Notifications = {
  /** null until the first load answers. */
  items: Notification[] | null
  error: string | null
  reload: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  clearAll: () => Promise<void>
}

// Three contexts so a reader re-renders only for what it uses: the counts, the list, or neither
// (refresh never changes).
const SummaryCtx = createContext<InboxSummary | null>(null)
const RefreshCtx = createContext<(() => Promise<void>) | null>(null)
const NotesCtx = createContext<Notifications | null>(null)

const POLL_MS = 20_000

const noop = async () => {}
const NO_NOTES: Notifications = { items: null, error: null, reload: noop, markRead: noop, markAllRead: noop, clearAll: noop }

// serverTime changes on every poll; nothing on screen depends on it.
const sameCounts = (a: InboxSummary, b: InboxSummary) =>
  JSON.stringify({ ...a, serverTime: "" }) === JSON.stringify({ ...b, serverTime: "" })

const unreadOf = (items: Notification[]) => items.filter((n) => !n.read).length

/**
 * One poll for the whole app shell (community C5): unread notifications and chats, every 20 s
 * while the tab is visible. The notifications row, the Chats badge and the chat page all read it.
 * It also holds the one notifications list, shared by the sidebar menu and the home pages'
 * "Needs you"; the list reloads only when the poll's unread count stops matching it.
 */
export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<InboxSummary | null>(null)
  const [items, setItems] = useState<Notification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await inbox.summary()
    setSummary((prev) => (prev && sameCounts(prev, next) ? prev : next))
  }, [])

  // Server data only: if the request fails the list says so (it used to fall back to a browser
  // copy and look current).
  const reload = useCallback(async () => {
    setError(null)
    try {
      setItems(await inbox.notifications())
    } catch (err) {
      setError(apiError(err, "Couldn't load notifications."))
    }
  }, [])

  useEffect(() => {
    // Sample chats, votes and the old per-browser Ghost Mode live on the server now.
    purgeLegacyStorage()
    refresh().catch(() => {})
    reload()
  }, [refresh, reload])

  usePoll(refresh, POLL_MS)

  // A notification came or went somewhere else (or a read in another tab): load the list again.
  // Not while the first load is on its way, which would fetch it twice.
  const serverUnread = summary?.notifications.unread
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => {
    const list = itemsRef.current
    if (serverUnread !== undefined && list && serverUnread !== unreadOf(list)) reload()
  }, [serverUnread, reload])

  const markRead = useCallback(async (id: string) => {
    setItems((list) => list && list.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await inbox.markNotificationRead(id)
    } catch {
      // Not worth interrupting for: it shows as unread again on the next load.
    }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await inbox.markAllNotificationsRead()
      setItems((list) => list && list.map((n) => ({ ...n, read: true })))
    } catch (err) {
      setError(apiError(err, "Couldn't mark notifications read."))
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      await inbox.clearNotifications()
      setItems([])
    } catch (err) {
      setError(apiError(err, "Couldn't clear notifications."))
    }
  }, [])

  const notes = useMemo<Notifications>(
    () => ({ items, error, reload, markRead, markAllRead, clearAll }),
    [items, error, reload, markRead, markAllRead, clearAll],
  )

  return (
    <RefreshCtx.Provider value={refresh}>
      <SummaryCtx.Provider value={summary}>
        <NotesCtx.Provider value={notes}>{children}</NotesCtx.Provider>
      </SummaryCtx.Provider>
    </RefreshCtx.Provider>
  )
}

export function useInbox(): InboxContext {
  const summary = useContext(SummaryCtx)
  const refresh = useContext(RefreshCtx) ?? noop
  return { summary, refresh }
}

/** Just the poll's refresh: never changes, so it doesn't re-render the caller. */
export function useInboxRefresh(): () => Promise<void> {
  return useContext(RefreshCtx) ?? noop
}

export function useNotifications(): Notifications {
  return useContext(NotesCtx) ?? NO_NOTES
}
