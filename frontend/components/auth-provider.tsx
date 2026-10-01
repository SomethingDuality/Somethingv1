"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import apiClient from "@/lib/axios"

type User = {
  id?: string
  name?: string
  email?: string
  role?: string
  plan?: string
  avatarUrl?: string | null
  hasPassword?: boolean
  authProviders?: string[]
  isAdmin?: boolean
  /** Investors only: on unless they turned it off (C5). */
  ghostMode?: boolean
} | null

type GoogleExtras = { role?: "founder" | "investor"; accepted_terms?: boolean }

type AuthContextShape = {
  user: User
  loading: boolean
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const me = await fetchMe()
        setUser(me)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    init()

    // auth:login event fired by signup/login pages after successful auth
    const handler = () => {
      ;(async () => {
        setLoading(true)
        try {
          setUser(await fetchMe())
        } catch {
          setUser(null)
        } finally {
          setLoading(false)
        }
      })()
    }

    // auth:expired is fired by the axios interceptor when a token refresh fails
    const expired = () => setUser(null)

    window.addEventListener("auth:login", handler)
    window.addEventListener("auth:expired", expired)
    return () => {
      window.removeEventListener("auth:login", handler)
      window.removeEventListener("auth:expired", expired)
    }
  }, [])

  // Called after any successful sign-in: load the user and reset per-account browser state.
  const afterAuth = async () => {
    const me = await fetchMe()
    setUser(me)

    if (me) {
      localStorage.removeItem("founder_profile_data")
      localStorage.removeItem("investor_profile_data")
      localStorage.removeItem("founder_milestones")
      localStorage.removeItem("investor_portfolio")
    }
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

  const refreshMe = async () => {
    try {
      const me = await fetchMe()
      setUser(me)
      return me
    } catch {
      setUser(null)
      return null
    }
  }

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout")
    } catch (err) {
      console.warn("Server logout failed, clearing local session", err)
    } finally {
      localStorage.removeItem("demo_name")
      localStorage.removeItem("demo_email")
      localStorage.removeItem("demo_role")
      localStorage.removeItem("selected_plan")
      localStorage.removeItem("founder_profile_data")
      localStorage.removeItem("investor_profile_data")
      localStorage.removeItem("founder_milestones")
      localStorage.removeItem("investor_portfolio")
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, refreshMe, completeSignIn: afterAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
