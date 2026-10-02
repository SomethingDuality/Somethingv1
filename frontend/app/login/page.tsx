"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { cn } from "@/lib/utils"
import { sameSitePath } from "@/lib/next-path"
import { homeFor, useAuth } from "@/components/auth-provider"
import { AuthError, AuthShell } from "@/components/auth/auth-shell"
import { AuthInput, apiErrorMessage } from "@/components/auth/auth-input"
import { GoogleSignInButton, OrDivider } from "@/components/google-sign-in-button"
import { pillClass, quietLinkClass } from "@/components/shell/page"

type Role = "founder" | "investor"
type TestAccount = { role: Role; name: string; email: string }

/** Go back to the page that sent us here (RequireAuth adds ?next=), else the role's home.
 *  Only same-site paths are honoured, so ?next can't become an open redirect. */
function destination(role?: string) {
  const next = new URLSearchParams(window.location.search).get("next")
  return sameSitePath(next, window.location.origin) ?? homeFor(role)
}

const outlinePill =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full border border-input px-5 text-[15px] text-foreground transition-colors hover:border-muted-foreground disabled:opacity-40 cursor-pointer"

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithGoogle, completeSignIn } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A first-time Google user must pick a role; we keep their credential in memory meanwhile.
  const [pendingGoogle, setPendingGoogle] = useState<string | null>(null)
  // One-click test accounts: only in a dev build, and only when the API says dev login is on.
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([])

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    apiClient
      .get<{ accounts: TestAccount[] }>("/auth/dev-login")
      .then((r) => setTestAccounts(r.data.accounts ?? []))
      .catch(() => setTestAccounts([]))
  }, [])

  const valid = email.trim().length > 3 && password.length > 0

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || loading) return
    setLoading(true)
    setError(null)
    try {
      const me = await login(email.trim(), password)
      router.replace(destination(me?.role))
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Invalid credentials or server error"))
    } finally {
      setLoading(false)
    }
  }

  const onTestAccount = async (role: Role) => {
    setLoading(true)
    setError(null)
    try {
      await apiClient.post("/auth/dev-login", { role })
      const me = await completeSignIn()
      router.replace(destination(me?.role))
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Test sign-in failed. Is the API running with npm run dev:memory?"))
      setLoading(false)
    }
  }

  const onGoogle = async (credential: string, role?: Role) => {
    setError(null)
    try {
      const me = await loginWithGoogle(credential, role ? { role, accepted_terms: true } : {})
      router.replace(destination(me?.role))
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: { code?: string } } })?.response
      if (res?.status === 409 && res.data?.code === "ROLE_REQUIRED") {
        setPendingGoogle(credential)
      } else {
        setError(apiErrorMessage(err, "Google sign-in failed. Please try again."))
      }
    }
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here? <Link href="/signup" className="text-foreground hover:underline underline-offset-4">Create an account</Link>
        </>
      }
    >
      {pendingGoogle ? (
        <div className="space-y-4">
          <p className="text-[15px]">New here. Are you a founder or an investor?</p>
          <div className="flex gap-3">
            {(["founder", "investor"] as Role[]).map((r) => (
              <button key={r} type="button" className={cn(outlinePill, "capitalize")} onClick={() => onGoogle(pendingGoogle, r)}>
                {r}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Continuing means you agree to the <Link href="/terms" className="underline underline-offset-4">Terms</Link>.
          </p>
          {error && <AuthError>{error}</AuthError>}
        </div>
      ) : (
        <>
          {testAccounts.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Local development</p>
              <div className="flex flex-wrap gap-3">
                {testAccounts.map((a) => (
                  <button key={a.role} type="button" disabled={loading} onClick={() => onTestAccount(a.role)} className={outlinePill}>
                    Continue as test {a.role}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <GoogleSignInButton text="signin_with" onCredential={(c) => onGoogle(c)} />
            <OrDivider />
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <AuthInput id="email" type="email" label="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" autoComplete="email" required />
            <AuthInput id="password" type="password" label="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required
              labelAside={<Link href="/forgot" className={cn(quietLinkClass, "text-sm")}>Forgot password?</Link>} />

            {error && <AuthError>{error}</AuthError>}

            <button type="submit" disabled={!valid || loading} className={pillClass}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
