"use client"

import { useState } from "react"
import apiClient from "@/lib/axios"
import { useAuth } from "@/components/auth-provider"
import { toast } from "@/components/ui/use-toast"
import { apiError } from "@/lib/utils"

/**
 * An investor's Ghost Mode, kept on the server (community C5): new chats start as "Ghost
 * investor" while it's on. It's on unless they turned it off; chats already started keep the
 * setting they began with.
 */
export function useGhostMode() {
  const { user, refreshMe } = useAuth()
  const [saving, setSaving] = useState(false)
  const on = user?.ghostMode !== false

  const set = async (next: boolean) => {
    setSaving(true)
    try {
      await apiClient.put("/investor/ghost-mode", { on: next })
      await refreshMe()
      toast({
        title: next ? "Ghost Mode on" : "Ghost Mode off",
        description: next
          ? "New chats show “Ghost investor” until you share your name."
          : "New chats show your name. Chats you already started stay as they are.",
      })
    } catch (err) {
      toast({ title: "Not changed", description: apiError(err, "Please try again."), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return { on, set, saving }
}
