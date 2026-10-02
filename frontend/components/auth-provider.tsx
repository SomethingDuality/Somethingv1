"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import apiClient, { isAuthFailure } from "@/lib/axios"

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
  user: User
  loading: boolean
  /** /auth/me failed without saying "signed out" (offline, a 5xx): the user is unknown, not gone. */
  unreachable: boolean
  login: (email: string, password: string) => Promise<User>
  /** Throws the axios error on failure; a 409 with code ROLE_REQUIRED means "ask for the role". */
  loginWithGoogle: (credential: string, extras?: GoogleExtras) => Promise<User>
  /** Re-reads /auth/me, e.g. after a profile change. */
  refreshMe: () => Promise<User>
  /** After signing in by any route (e.g. signup): load the user and reset per-account browser state. */
  completeSignIn: () => Promise<User>
  logout: () => Promise<void>
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

// Only the server saying so signs someone out (the interceptor has already tried a refresh; a 404
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
  const [unreachable, setUnreachable] = useState(false)

  /** Reads /auth/me into `user`. On an outage it keeps the current user and says so instead. */
  const loadMe = useCallback(async (): Promise<User> => {
    try {
      const me = await fetchMe()
      setUser(me)
      setUnreachable(false)
      return me
    } catch (err) {
      const out = signedOut(err)
      if (out) setUser(null)
      setUnreachable(!out)
      return null
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await loadMe()
      setLoading(false)
    }

    init()

    // auth:login event fired by signup/login pages after successful auth
    const handler = () => {
      ;(async () => {
        setLoading(true)
        await loadMe()
        setLoading(false)
      })()
    }

    // auth:expired is fired by the axios interceptor when a token refresh is refused
    const expired = () => {
      setUser(null)
      setUnreachable(false)
    }

    window.addEventListener("auth:login", handler)
    window.addEventListener("auth:expired", expired)
    return () => {
      window.removeEventListener("auth:login", handler)
      window.removeEventListener("auth:expired", expired)
    }
  }, [loadMe])

  // Called after any successful sign-in: load the user and reset per-account browser state.
  const afterAuth = async () => {
    const me = await fetchMe()
    setUser(me)
    setUnreachable(false)

    if (me) forgetLocalData(PER_ACCOUNT_KEYS)
    return me
  }

  const login = async (email: string, password: string) => {
    await apiClient.post("/auth/login", { email, password })
    return afterAuth()
  }

  const loginWithGoogle = async (credential: string, extras: GoogleExtras = {}) => {
    await apiClient.post("/auth/google", { credential, ...extras })
    return afterAuth()
  }

  const refreshMe = loadMe

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout")
    } catch (err) {
      console.warn("Server logout failed, clearing local session", err)
    } finally {
      forgetLocalData(["demo_name", "demo_email", "demo_role", "selected_plan", ...PER_ACCOUNT_KEYS])
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, unreachable, login, loginWithGoogle, refreshMe, completeSignIn: afterAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
