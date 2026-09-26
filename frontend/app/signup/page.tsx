"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import apiClient from "@/lib/axios"
import { homeFor, useAuth } from "@/components/auth-provider"
import { AuthError, AuthShell } from "@/components/auth/auth-shell"
import { AuthInput, apiErrorMessage } from "@/components/auth/auth-input"
import { GoogleSignInButton, OrDivider, googleSignInEnabled } from "@/components/google-sign-in-button"
import { pillClass } from "@/components/shell/page"
import { cn } from "@/lib/utils"

type Role = "founder" | "investor"

const ROLE_COPY: Record<Role, string> = {
  founder: "I'm a founder",
  investor: "I'm an investor",
}

/**
 * Signup asks for four things: name, email, password, terms. The role comes from the link that
 * brought the user here (?role=founder|investor), so it isn't asked twice. Everything else
 * (skills, sectors, links...) is asked later, one optional question at a time, by the Something box.
 */
export default function SignupPage() {
  const router = useRouter()
  const { completeSignIn, loginWithGoogle } = useAuth()

  const [role, setRole] = useState<Role | null>(null)
  const [roleFromLink, setRoleFromLink] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<React.ReactNode>(null)

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("role")?.toLowerCase()
    if (r === "founder" || r === "investor") {
      setRole(r)
      setRoleFromLink(true)
    }
  }, [])

  const valid = Boolean(role) && name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8 && terms

  const finish = (me: { role?: string } | null) => {
    localStorage.removeItem("onboarding_complete")
    router.replace(homeFor(me?.role))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || loading || !role) return
    setLoading(true)
    setError(null)
    try {
      await apiClient.post("/auth/signup", {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        accepted_terms: terms,
      })
      finish(await completeSignIn())
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setError(
          <>
            An account with this email already exists.{" "}
            <Link href="/login" className="underline underline-offset-4">Sign in</Link>
          </>
        )
      } else {
        setError(apiErrorMessage(err, "Signup failed. Please check your details and try again."))
      }
    } finally {
      setLoading(false)
    }
  }

  const onGoogle = async (credential: string) => {
    if (!role) return
    setError(null)
    try {
      finish(await loginWithGoogle(credential, { role, accepted_terms: true }))
    } catch (err) {
      setError(apiErrorMessage(err, "Google sign-in failed. Please try again."))
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Four details now. Everything else is optional, one question at a time."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground hover:underline underline-offset-4">Sign in</Link>
        </>
      }
    >
      {roleFromLink && role ? (
        <p className="text-[15px] text-muted-foreground">
          Signing up as {role === "founder" ? "a founder" : "an investor"}.{" "}
          <button type="button" className="text-foreground underline underline-offset-4 cursor-pointer" onClick={() => setRoleFromLink(false)}>
            Change
          </button>
        </p>
      ) : (
        <div role="radiogroup" aria-label="Founder or investor" className="flex flex-wrap gap-2">
          {(["founder", "investor"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={cn(
                "rounded-full border px-4 py-2 text-[15px] transition-colors cursor-pointer",
                role === r ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {ROLE_COPY[r]}
            </button>
          ))}
        </div>
      )}

      {role && googleSignInEnabled && (
        <div className="space-y-4">
          <GoogleSignInButton text="signup_with" onCredential={onGoogle} />
          <p className="text-sm text-muted-foreground">
            Continuing with Google means you agree to the <Link href="/terms" className="underline underline-offset-4">Terms</Link>.
          </p>
          <OrDivider />
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <AuthInput id="name" label="Name" value={name}
          onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={100} placeholder="Your name" />
        <AuthInput id="email" type="email" label="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="name@domain.com" />
        <AuthInput id="password" type="password" label="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8}
          placeholder="At least 8 characters" />

        <label className="flex items-start gap-3 text-[15px] text-muted-foreground cursor-pointer">
          <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
          <span>
            I agree to the <Link href="/terms" className="text-foreground underline underline-offset-4">Terms</Link>.
          </span>
        </label>

        {error && <AuthError>{error}</AuthError>}

        <button type="submit" disabled={!valid || loading} className={pillClass}>
          {loading ? "Creating your account…" : "Create account"}
        </button>

      </form>
    </AuthShell>
  )
}
