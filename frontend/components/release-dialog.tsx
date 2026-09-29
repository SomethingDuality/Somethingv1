"use client"

import { useEffect, useState } from "react"
import apiClient from "@/lib/axios"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pillClass, quietLinkClass, usd } from "@/components/shell/page"
import { apiError } from "@/lib/utils"

/** The commitment (and optionally the milestone) a release is recorded against. */
export type ReleaseTarget = {
  investmentId: string
  ideaName: string
  committed: number
  released: number
  milestone?: { id: string; title: string }
}

const field =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"

/** Records that part of a commitment was released. It is a record only: no money moves. */
export function ReleaseDialog({ target, onClose, onDone }: { target: ReleaseTarget | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const left = target ? target.committed - target.released : 0

  useEffect(() => {
    setAmount(target ? String(target.committed - target.released) : "")
    setError(null)
  }, [target])

  const submit = async () => {
    if (!target) return
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0 || n > left) {
      setError(`Enter an amount between $1 and ${usd(left)}.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiClient.post(`/investor/portfolio/${target.investmentId}/release`, {
        amount: n,
        ...(target.milestone ? { milestoneId: target.milestone.id } : {}),
      })
      onDone()
    } catch (err) {
      setError(apiError(err, "Couldn't record the release."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-md rounded-2xl border-border bg-popover p-8 text-popover-foreground">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-medium">Record a release</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            {target
              ? `For “${target.ideaName}”${target.milestone ? `, milestone “${target.milestone.title}”` : ""}. ${usd(left)} of your ${usd(target.committed)} is still committed.`
              : ""}{" "}
            No money moves on Something yet: this records that you released it, and the founder is told.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="mt-4 space-y-4">
          <label htmlFor="release-amount" className="block text-[15px]">Amount, US dollars</label>
          <input
            id="release-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
            className={field}
          />
          {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-5 pt-2">
            <button type="button" onClick={onClose} className={quietLinkClass}>Cancel</button>
            <button type="submit" disabled={saving || !amount} className={pillClass}>{saving ? "Saving…" : "Record release"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
