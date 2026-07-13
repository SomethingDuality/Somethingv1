"use client"

import React, { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "./auth-provider"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    // Only redirect once — prevents the loop caused by repeated re-renders
    if (!loading && !user && !redirected.current) {
      redirected.current = true
      router.push('/login')
    }
    // Reset if user becomes authenticated again (e.g. after token refresh)
    if (user) redirected.current = false
  }, [loading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !user) return null

  return <>{children}</>
}
