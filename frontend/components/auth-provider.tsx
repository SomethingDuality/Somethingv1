"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import apiClient from "@/lib/axios"

type User = {
  id?: string
  name?: string
  email?: string
  role?: string
  plan?: string
} | null

type AuthContextShape = {
  user: User
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
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

    window.addEventListener("auth:login", handler)
    return () => window.removeEventListener("auth:login", handler)
  }, [])

  const login = async (email: string, password: string) => {
    await apiClient.post("/auth/login", { email, password })
    const me = await fetchMe()
    setUser(me)

    if (me) {
      localStorage.removeItem("founder_profile_data")
      localStorage.removeItem("investor_profile_data")
      localStorage.removeItem("founder_milestones")
      localStorage.removeItem("investor_portfolio")
      localStorage.setItem("demo_name",     me.name  || "")
      localStorage.setItem("demo_email",    me.email || "")
      localStorage.setItem("demo_role",     me.role  || "founder")
      localStorage.setItem("selected_plan", me.plan  || "free")
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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
