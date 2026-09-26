"use client"

import { useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { AuthError, AuthShell } from "@/components/auth/auth-shell"
import { AuthInput, apiErrorMessage } from "@/components/auth/auth-input"
import { pillClass } from "@/components/shell/page"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      await apiClient.post("/auth/forgot-password", { email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send the reset link. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link that works once, for 30 minutes."
      footer={<Link href="/login" className="text-foreground hover:underline underline-offset-4">Back to sign in</Link>}
    >
      {sent ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          If an account exists for <span className="text-foreground">{email.trim()}</span>, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <AuthInput id="email" type="email" label="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="name@domain.com" />
          {error && <AuthError>{error}</AuthError>}
          <button type="submit" disabled={!email.trim() || loading} className={pillClass}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
