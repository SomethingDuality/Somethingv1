"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useNotifications } from "@/components/community/inbox-provider"
import { notificationsRowClass } from "@/components/shell/menu-rows"
import { useIsMobile } from "@/hooks/use-mobile"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Notification } from "@/lib/inbox-transport"
import { cn } from "@/lib/utils"
import { when } from "@/lib/format"

/**
 * The sidebar's "Notifications" row and its list. The list lives in the shell's InboxProvider
 * (shared with the home pages' "Needs you"), which reloads it when the inbox poll (every 20 s
 * while the tab is visible) says the unread count changed; opening the menu doesn't fetch again.
 * Unread ones are counted on the row and shown in full colour; opening one marks it read and
 * goes to the page it is about. "Clear all" deletes them.
 */
export function NotificationsDropdown() {
  const router = useRouter()
  // Beside the sidebar on laptops; above the row in the phone menu, where there's no room beside it.
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const { items, error, reload, markRead, markAllRead, clearAll } = useNotifications()
  const list = items ?? []
  const unread = list.filter((n) => !n.read).length

  const openItem = (n: Notification) => {
    if (!n.read) markRead(n.id)
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={notificationsRowClass}>
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
          {items === null && !error ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="px-3 py-4 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <button type="button" onClick={reload} className="text-sm underline underline-offset-4 cursor-pointer">Retry</button>
            </div>
          ) : list.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {list.map((n) => (
                // Long lists: rows far below the fold aren't laid out until scrolled near.
                <li key={n.id} className="border-b border-border last:border-0 [content-visibility:auto] [contain-intrinsic-size:auto_76px]">
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
        {list.length > 0 && (
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
