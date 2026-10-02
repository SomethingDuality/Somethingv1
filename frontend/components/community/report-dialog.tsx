"use client"

import { useRef, useState } from "react"
import apiClient from "@/lib/axios"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pillClass, quietLinkClass } from "@/components/shell/page"
import { toast } from "@/components/ui/use-toast"
import { apiError, cn } from "@/lib/utils"

const REASONS = [
  { id: "spam", label: "Spam" },
  { id: "scam", label: "Scam" },
  { id: "harassment", label: "Harassment" },
  { id: "off_topic", label: "Off-topic" },
  { id: "personal_info", label: "Personal info" },
  { id: "other", label: "Something else" },
] as const

type Reason = (typeof REASONS)[number]["id"]
type Target = { type: "idea" | "comment" | "problem" | "message"; id: string }

/**
 * A quiet "Report" link and its dialog: one tap for the reason, a note only if wanted.
 * Enough reports hide the item until an admin looks (ideas 5, comments and problems 3).
 */
export function ReportButton({ type, id, className }: Target & { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(quietLinkClass, className)}>
        Report
      </button>
      <ReportDialog target={open ? { type, id } : null} onClose={() => setOpen(false)} />
    </>
  )
}

/** The dialog alone, open while `target` is set: a long list (a chat) shares one. */
export function ReportDialog({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const [reason, setReason] = useState<Reason | null>(null)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Keeps the title right while the dialog animates out after `target` is cleared.
  const last = useRef(target)
  if (target) last.current = target
  const type = last.current?.type

  const close = () => {
    onClose()
    setReason(null)
    setNote("")
    setError(null)
  }

  const send = async () => {
    if (!reason || !target) return
    setSending(true)
    setError(null)
    try {
      const res = await apiClient.post<{ alreadyReported: boolean }>("/reports", { type: target.type, id: target.id, reason, ...(note.trim() && { note: note.trim() }) })
      close()
      toast(res.data.alreadyReported
        ? { title: "You already reported this", description: "We have it. Thanks." }
        : { title: "Thanks for telling us", description: "We'll take a look." })
    } catch (err) {
      setError(apiError(err, "Couldn't send the report."))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="w-full max-w-md rounded-2xl border-border bg-popover p-8 text-popover-foreground">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-medium">Report this {type}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            What&apos;s wrong with it? The person who posted it won&apos;t see who reported it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="mt-4 space-y-5">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={reason === r.id}
                onClick={() => setReason(r.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-[15px] transition-colors cursor-pointer",
                  reason === r.id ? "border-foreground bg-foreground text-background" : "border-line text-foreground/90 hover:border-muted-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={2}
            aria-label="Anything we should know (optional)"
            placeholder="Anything we should know? (optional)"
            className="block w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none sm:text-[15px]"
          />
          {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-5">
            <button type="button" onClick={close} className={quietLinkClass}>Cancel</button>
            <button type="submit" disabled={!reason || sending} className={pillClass}>{sending ? "Sending…" : "Send report"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** For the author only: why their own item isn't public right now. */
export function HiddenNotice({ state, what, className }: { state?: "hidden" | "removed"; what: string; className?: string }) {
  if (!state) return null
  return (
    <p role="status" className={cn("rounded-2xl border border-line bg-surface px-5 py-4 text-[15px] leading-relaxed text-muted-foreground", className)}>
      {state === "hidden"
        ? <>Only you can see {what} right now: it&apos;s hidden while we look at some reports. We&apos;ll tell you when it&apos;s back.</>
        : <>Only you can see {what}: it was removed because it breaks the community rules.</>}
    </p>
  )
}
