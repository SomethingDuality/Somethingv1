"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { inbox, type InboxSummary } from "@/lib/inbox-transport"
import { usePoll } from "@/hooks/use-poll"
import { purgeLegacyStorage } from "@/lib/local-keys"

type InboxContext = { summary: InboxSummary | null; refresh: () => Promise<void> }

const Ctx = createContext<InboxContext | null>(null)

const POLL_MS = 20_000

/**
 * One poll for the whole app shell (community C5): unread notifications and chats, every 20 s
 * while the tab is visible. The notifications row, the Chats badge and the chat page all read it.
 */
export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<InboxSummary | null>(null)

  const refresh = useCallback(async () => {
    setSummary(await inbox.summary())
  }, [])

  useEffect(() => {
    // Sample chats, votes and the old per-browser Ghost Mode live on the server now.
    purgeLegacyStorage()
    refresh().catch(() => {})
  }, [refresh])

  usePoll(refresh, POLL_MS)

  return <Ctx.Provider value={{ summary, refresh }}>{children}</Ctx.Provider>
}

export function useInbox(): InboxContext {
  return useContext(Ctx) ?? { summary: null, refresh: async () => {} }
}
