"use client"

import { useState, useEffect } from "react"
import apiClient from "@/lib/axios"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Bell, Check, Loader2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  text: string
  read: boolean
  timestamp: string
}

const DEFAULT_NOTIFICATIONS: Notification[] = []

// Stored Database Helpers
function getStoredNotifications(): Notification[] {
  if (typeof window === "undefined") return []
  const saved = localStorage.getItem("founder_notifications")
  return saved ? JSON.parse(saved) : []
}

function setStoredNotifications(notifications: Notification[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("founder_notifications", JSON.stringify(notifications))
  }
}

const notificationsAPI = {
  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await apiClient.get<Notification[]>("/notifications")
      return response.data
    } catch (error) {
      console.warn("Error fetching notifications, using local store:", error)
      return getStoredNotifications()
    }
  },

  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.post("/notifications/mark-all-read", {})
    } catch (error) {
      console.warn("Error marking notifications as read on server, updating locally:", error)
      const data = getStoredNotifications()
      const updated = data.map((n) => ({ ...n, read: true }))
      setStoredNotifications(updated)
    }
  },
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  const fetchNotifications = async () => {
    setIsLoading(true)
    const data = await notificationsAPI.getNotifications()
    setNotifications(data)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      const updated = notifications.map((n) => ({ ...n, read: true }))
      setNotifications(updated)
      setStoredNotifications(updated)
    } catch (error) {
      console.error(error)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative border border-border/40 text-foreground/60 hover:bg-accent hover:text-foreground rounded-full bg-transparent transition-all h-8 w-8"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#34D399] text-black text-[11px] font-bold shadow-[0_0_8px_rgba(52,211,153,0.5)] border-0"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-popover border border-border text-popover-foreground backdrop-blur-xl rounded-2xl shadow-2xl p-2">
        <DropdownMenuLabel className="font-semibold text-[10px] text-muted-foreground px-3 py-2 uppercase tracking-wider font-mono">
          Inbox Alerts
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border mx-2" />
        <div className="max-h-72 overflow-y-auto my-1" style={{ scrollbarWidth: "thin" }}>
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-accent)]" />
            </div>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex items-start gap-3 p-3 focus:bg-accent rounded-xl cursor-pointer transition-colors focus:text-foreground"
              >
                <div
                  className={cn(
                    "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full transition-all",
                    notification.read
                      ? "bg-transparent"
                      : "shadow-[0_0_6px_var(--brand-accent)]"
                  )}
                  style={!notification.read ? { background: "var(--brand-accent)" } : undefined}
                />
                <div className="flex-1 space-y-1">
                  <p className={cn(
                    "text-xs leading-normal font-sans",
                    notification.read ? "text-muted-foreground font-light" : "text-foreground font-medium"
                  )}>
                    {notification.text}
                  </p>
                  <span className="block text-[11px] font-mono text-muted-foreground/60">{notification.timestamp}</span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <p className="p-6 text-center text-xs text-muted-foreground font-mono">No alerts received.</p>
          )}
        </div>
        <DropdownMenuSeparator className="bg-border mx-2" />
        <DropdownMenuItem
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0}
          className="flex items-center justify-center gap-2 p-2.5 text-xs text-muted-foreground hover:text-foreground focus:bg-accent rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold font-mono"
        >
          <Check className="h-3.5 w-3.5" /> Mark all as read
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}