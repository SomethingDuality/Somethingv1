"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { AuthError, AuthShell } from "@/components/auth/auth-shell"
import { apiErrorMessage } from "@/components/auth/auth-input"

// The link from the signup email. The token works once, so it is sent once (strict mode runs
// effects twice in development).
export default function VerifyEmailPage() {
  const [state, setState] = useState<"checking" | "done" | "missing" | "failed">("checking")
  const [error, setError] = useState<string | null>(null)
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    const token = new URLSearchParams(window.location.search).get("token")
    if (!token) {
      setState("missing")
      return
    }
    apiClient.post("/auth/verify-email", { token })
      .then(() => setState("done"))
      .catch((err) => {
        setError(apiErrorMessage(err, "This link is invalid or has expired.").replace(/([^.!?])$/, "$1."))
        setState("failed")
      })
  }, [])

  return (
    <AuthShell
      title="Verify your email"
      footer={<Link href="/login" className="text-foreground hover:underline underline-offset-4">Go to sign in</Link>}
    >
      {state === "checking" ? (
        <p className="text-[15px] text-muted-foreground">Checking your link…</p>
      ) : state === "done" ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Your email is verified. <Link href="/login" className="text-foreground underline underline-offset-4">Continue</Link>.
        </p>
      ) : state === "missing" ? (
        <AuthError>This link is missing its token. Open the link from the email again.</AuthError>
      ) : (
        <AuthError>{error} You can ask for a new link from your settings.</AuthError>
      )}
    </AuthShell>
  )
}
