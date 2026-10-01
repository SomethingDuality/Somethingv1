"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pillClass, quietLinkClass } from "@/components/shell/page"
import { useAuth } from "@/components/auth-provider"
import { useSomethingBox } from "@/components/something-box/provider"
import { inbox, newClientId } from "@/lib/inbox-transport"
import { apiError } from "@/lib/utils"

/**
 * The first message of a chat about an idea (community C5): an investor writing to the founder,
 * or a founder asking to join. The message comes prefilled; the recipient is the idea's founder.
 * Links wait until they reply. An investor in Ghost Mode is told exactly what the founder sees.
 */
export function StartChatDialog({ open, onOpenChange, ideaId, ideaTitle, founderName, role }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ideaId: string
  ideaTitle: string
  founderName?: string
  role: "founder" | "investor"
}) {
  const router = useRouter()
  const { user } = useAuth()
  const box = useSomethingBox()
  const first = (founderName || "").trim().split(/\s+/)[0]
  const greeting = first ? `Hi ${first}` : "Hi"
  const prefill = role === "investor"
    ? `${greeting}, I read “${ideaTitle}” and I'd like to hear more. What are you working on next?`
    : `${greeting}, I'd like to help with “${ideaTitle}”. I could take on `
  const [text, setText] = useState(prefill)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState(newClientId)
  const ghost = role === "investor" && user?.ghostMode !== false

  useEffect(() => {
    if (!open) return
    setText(prefill)
    setError(null)
    setClientId(newClientId())
    // What helps here: an investor's stages (the ghost hint), a founder's skills.
    box.requestJIT(role === "investor" ? "start_chat" : "collaborate", false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    try {
      const out = await inbox.start(ideaId, body, clientId)
      onOpenChange(false)
      router.push(`/${role}/chats?thread=${out.thread.id}`)
    } catch (err) {
      setError(apiError(err, "The message wasn't sent. Please try again."))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg rounded-2xl border-border bg-popover p-8 text-popover-foreground">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-medium">
            {role === "investor" ? `Message ${first || "the founder"}` : `Ask to join “${ideaTitle}”`}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            {first || "The founder"} sees this as a request. Once they reply, you can talk freely. Links can wait until then.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="mt-4 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            rows={4}
            aria-label="Your first message"
            className="block w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base leading-relaxed text-foreground focus:border-muted-foreground focus:outline-none sm:text-[15px]"
          />
          {ghost && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              You&apos;re in Ghost Mode: {first || "the founder"} sees &ldquo;Ghost investor&rdquo; and the stages you invest in, not your name.
              You can share your name in the chat any time. <Link href="/investor/settings" className="text-foreground underline underline-offset-4">Settings</Link>
            </p>
          )}
          {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-5">
            <button type="button" onClick={() => onOpenChange(false)} className={quietLinkClass}>Cancel</button>
            <button type="submit" disabled={!text.trim() || sending} className={pillClass}>{sending ? "Sending…" : "Send"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
