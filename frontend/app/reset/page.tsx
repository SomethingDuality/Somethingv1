"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { AuthError, AuthShell } from "@/components/auth/auth-shell"
import { AuthInput, apiErrorMessage } from "@/components/auth/auth-input"
import { pillClass } from "@/components/shell/page"

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || password.length < 8 || loading) return
    setLoading(true)
    setError(null)
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword: password })
      setDone(true)
    } catch (err) {
      setError(apiErrorMessage(err, "This reset link is invalid or has expired."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      footer={<Link href="/login" className="text-foreground hover:underline underline-offset-4">Back to sign in</Link>}
    >
      {done ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Password updated. <Link href="/login" className="text-foreground underline underline-offset-4">Sign in</Link> with your new password.
        </p>
      ) : token === null ? null : !token ? (
        <AuthError>
          This link is missing its token. <Link href="/forgot" className="underline underline-offset-4">Request a new one</Link>.
        </AuthError>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <AuthInput id="password" type="password" label="New password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required
            placeholder="At least 8 characters" />
          {error && <AuthError>{error}</AuthError>}
          <button type="submit" disabled={password.length < 8 || loading} className={pillClass}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
