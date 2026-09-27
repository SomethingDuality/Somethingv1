"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import apiClient from "@/lib/axios"
import { useAuth } from "@/components/auth-provider"
import { apiErrorMessage } from "@/components/auth/auth-input"

const FIELD = "h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
const BUTTON = "inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-input px-5 text-[15px] text-foreground hover:border-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"

/**
 * Real account security for both settings pages: the sign-in email (read-only for now) and a
 * password change that requires the current password. Google-only accounts can set a first one.
 */
export function AccountSecurity() {
  const { user, refreshMe } = useAuth()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [saving, setSaving] = useState(false)

  const hasPassword = user?.hasPassword !== false
  const google = user?.authProviders?.includes("google")
  const canSubmit = next.length >= 8 && (!hasPassword || current.length > 0) && !saving

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await apiClient.post("/auth/change-password", { currentPassword: current, newPassword: next })
      setCurrent("")
      setNext("")
      await refreshMe()
      toast({ title: hasPassword ? "Password updated" : "Password set", description: "Other devices were signed out." })
    } catch (err) {
      toast({ title: "Password not changed", description: apiErrorMessage(err, "Please try again."), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-[15px] text-foreground">Sign-in email</p>
        <p className="text-[15px] text-muted-foreground">
          {user?.email}
          {google && <span className="ml-3 text-sm">Google sign-in is on</span>}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <p className="text-[15px] text-foreground">{hasPassword ? "Change password" : "Set a password"}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {hasPassword && (
            <input type="password" placeholder="Current password" autoComplete="current-password" aria-label="Current password"
              value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD} />
          )}
          <input type="password" placeholder="New password, 8 or more characters" autoComplete="new-password" aria-label="New password"
            value={next} onChange={(e) => setNext(e.target.value)} className={FIELD} />
        </div>
        <button type="submit" disabled={!canSubmit} className={BUTTON}>
          {saving ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </button>
      </form>
    </div>
  )
}

/** Deletes the account for real. The user types their email to confirm. */
export function DeleteAccount() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [confirmEmail, setConfirmEmail] = useState("")
  const [deleting, setDeleting] = useState(false)

  const matches = Boolean(user?.email) && confirmEmail.trim().toLowerCase() === user?.email?.toLowerCase()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matches || deleting) return
    setDeleting(true)
    try {
      await apiClient.delete("/auth/account", { data: { confirmEmail: confirmEmail.trim() } })
      await logout()
      router.replace("/")
    } catch (err) {
      toast({ title: "Account not deleted", description: apiErrorMessage(err, "Please try again."), variant: "destructive" })
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
        Deletes your account and everything you&apos;ve posted or committed. Comments you wrote stay up without your name. This can&apos;t be undone.
      </p>
      <label className="block space-y-2">
        <span className="block text-[15px] text-foreground">Type {user?.email ?? "your email"} to confirm</span>
        <input type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className={cn(FIELD, "max-w-md")} />
      </label>
      <button type="submit" disabled={!matches || deleting}
        className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-destructive px-5 text-[15px] text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
        {deleting ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  )
}
