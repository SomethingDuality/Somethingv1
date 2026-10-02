"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import apiClient, { isAuthFailure } from "@/lib/axios"
import { setCacheOwner } from "@/lib/api-cache"
import { forgetSession, hadSession, isPublicPath, readLastUser, rememberUser } from "@/lib/session-hint"

type User = {
  id?: string
  name?: string
  email?: string
  role?: string
  plan?: string
  avatarUrl?: string | null
  hasPassword?: boolean
  /** They opened the link we emailed (or signed in with Google). */
  emailVerified?: boolean
  authProviders?: string[]
  isAdmin?: boolean
  /** Investors only: on unless they turned it off (C5). */
  ghostMode?: boolean
} | null

type GoogleExtras = { role?: "founder" | "investor"; accepted_terms?: boolean }

type AuthContextShape = {
  /** Until /auth/me has answered (`checked`), the last user it confirmed in this tab, if any. */
  user: User
  loading: boolean
  /** /auth/me has answered at least once. A public page with no sign-in on this browser skips it. */
  checked: boolean
  /** /auth/me failed without saying "signed out" (offline, a 5xx): the user is unknown, not gone. */
  unreachable: boolean
  login: (email: string, password: string) => Promise<User>
  /** Throws the API error on failure; a 409 with code ROLE_REQUIRED means "ask for the role". */
  loginWithGoogle: (credential: string, extras?: GoogleExtras) => Promise<User>
  /** Re-reads /auth/me, e.g. after a profile change. */
  refreshMe: () => Promise<User>
  /** After signing in by any route (e.g. signup): load the user and reset per-account browser state. */
  completeSignIn: () => Promise<User>
  logout: () => Promise<void>
  /** Asks /auth/me if nothing has yet (RequireAuth, after a public page skipped it). */
  ensureChecked: () => void
}

/** Home path for a role as returned by /auth/me ("Founder" | "Investor"). */
export function homeFor(role?: string) {
  return role?.toLowerCase() === "investor" ? "/investor" : "/founder"
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined)

export function useAuth() {
  const c = useContext(AuthContext)
  if (!c) throw new Error("useAuth must be used within AuthProvider")
  return c
}

async function fetchMe(): Promise<User> {
  const res = await apiClient.get("/auth/me")
  return res.data ?? null
}

// Only the server saying so signs someone out (the client has already tried a refresh; a 404
// means the account is gone). A network error or a 5xx keeps whoever is signed in.
const signedOut = (err: unknown) =>
  isAuthFailure(err) || (err as { response?: { status?: number } })?.response?.status === 404

/** Local data that belongs to whoever was signed in. Blocked storage must not break signing out. */
function forgetLocalData(keys: string[]) {
  try {
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    // Private mode or blocked storage: nothing was kept.
  }
}
const PER_ACCOUNT_KEYS = ["founder_profile_data", "investor_profile_data", "founder_milestones", "investor_portfolio"]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User>(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState(false)
  const [unreachable, setUnreachable] = useState(false)
  const asked = useRef(false)

  /** Who is signed in now: kept as this tab's hint (or forgotten), and the GET cache's owner. */
  const adopt = useCallback((me: User) => {
    setCacheOwner(me?.id ?? null)
    if (me) rememberUser(me)
    else forgetSession()
    setUser(me)
  }, [])

  /** Reads /auth/me into `user`. On an outage it keeps the current user and says so instead. */
  const loadMe = useCallback(async (): Promise<User> => {
    asked.current = true
    try {
      const me = await fetchMe()
      adopt(me)
      setUnreachable(false)
      return me
    } catch (err) {
      const out = signedOut(err)
      if (out) adopt(null)
      setUnreachable(!out)
      return null
    } finally {
      setChecked(true)
    }
  }, [adopt])

  const ensureChecked = useCallback(() => {
    if (asked.current) return
    setLoading(true)
    loadMe().finally(() => setLoading(false))
  }, [loadMe])

  useEffect(() => {
    // Pages draw at once for the user this tab last confirmed while /auth/me is asked again;
    // RequireAuth still sends them away if the answer is no.
    const last = readLastUser()
    if (last) {
      setCacheOwner(last.id ?? null)
      setUser(last)
    }

    // A public page on a browser nobody has signed in on has nothing to ask: skipping saves the
    // 401 and the refresh (with its preflight) it would set off.
    if (isPublicPath(window.location.pathname) && !hadSession()) setLoading(false)
    else loadMe().finally(() => setLoading(false))

    // auth:login event fired by signup/login pages after successful auth
    const handler = () => {
      ;(async () => {
        setLoading(true)
        await loadMe()
        setLoading(false)
      })()
    }

    // auth:expired is fired by lib/axios when a token refresh is refused
    const expired = () => {
      adopt(null)
      setUnreachable(false)
    }

    window.addEventListener("auth:login", handler)
    window.addEventListener("auth:expired", expired)
    return () => {
      window.removeEventListener("auth:login", handler)
      window.removeEventListener("auth:expired", expired)
    }
  }, [loadMe, adopt])

  // Called after any successful sign-in: load the user and reset per-account browser state.
  const afterAuth = useCallback(async () => {
    const me = await fetchMe()
    asked.current = true
    adopt(me)
    setUnreachable(false)
    setChecked(true)

    if (me) forgetLocalData(PER_ACCOUNT_KEYS)
    return me
  }, [adopt])

  const login = useCallback(async (email: string, password: string) => {
    await apiClient.post("/auth/login", { email, password })
    return afterAuth()
  }, [afterAuth])

  const loginWithGoogle = useCallback(async (credential: string, extras: GoogleExtras = {}) => {
    await apiClient.post("/auth/google", { credential, ...extras })
    return afterAuth()
  }, [afterAuth])

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout")
    } catch (err) {
      console.warn("Server logout failed, clearing local session", err)
    } finally {
      forgetLocalData(["demo_name", "demo_email", "demo_role", "selected_plan", ...PER_ACCOUNT_KEYS])
      adopt(null)
    }
  }, [adopt])

  const value = useMemo<AuthContextShape>(
    () => ({ user, loading, checked, unreachable, login, loginWithGoogle, refreshMe: loadMe, completeSignIn: afterAuth, logout, ensureChecked }),
    [user, loading, checked, unreachable, login, loginWithGoogle, loadMe, afterAuth, logout, ensureChecked],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
