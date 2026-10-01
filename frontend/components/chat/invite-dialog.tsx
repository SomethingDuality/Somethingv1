"use client"

import { useEffect, useState } from "react"
import apiClient from "@/lib/axios"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pillClass, quietLinkClass } from "@/components/shell/page"
import { options } from "@/lib/taxonomy"
import { apiError, cn } from "@/lib/utils"

/**
 * "Invite to team" from a co-founder chat (community C6): pick their role in one tap, or say it
 * in your own words. They join only if they accept.
 */
export function InviteDialog({ open, onOpenChange, threadId, name, ideaTitle, onSent }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  threadId: string
  name: string
  ideaTitle: string
  onSent: () => void
}) {
  const roles = options("roles")
  const [role, setRole] = useState<string | null>(null)
  const [custom, setCustom] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = name.split(" ")[0] || name

  useEffect(() => {
    if (!open) return
    setRole(null)
    setCustom("")
    setError(null)
  }, [open])

  const chosen = custom.trim() || role
  const send = async () => {
    if (!chosen || sending) return
    setSending(true)
    setError(null)
    try {
      await apiClient.post("/teams/invites", { threadId, role: chosen })
      onOpenChange(false)
      onSent()
    } catch (err) {
      setError(apiError(err, "The invite wasn't sent."))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg rounded-2xl border-border bg-popover p-8 text-popover-foreground">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-medium">Invite {first} to &ldquo;{ideaTitle}&rdquo;</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            What would they do? {first} joins the team only if they accept.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="mt-4 space-y-5">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Role">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={role === r.value && !custom.trim()}
                onClick={() => { setRole(r.value); setCustom("") }}
                className={cn(
                  "rounded-full border px-4 py-2 text-[15px] transition-colors cursor-pointer",
                  role === r.value && !custom.trim() ? "border-foreground bg-foreground text-background" : "border-line text-foreground/90 hover:border-muted-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 40))}
            placeholder="Or in your own words, e.g. Growth"
            aria-label="Role in your own words"
            className="h-11 w-full rounded-full border border-input bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none sm:text-[15px]"
          />
          {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-5">
            <button type="button" onClick={() => onOpenChange(false)} className={quietLinkClass}>Cancel</button>
            <button type="submit" disabled={!chosen || sending} className={pillClass}>{sending ? "Sending…" : "Send invite"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
