"use client"

import React, { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { homeFor, useAuth } from "./auth-provider"

type Props = {
  children: React.ReactNode
  /** When set, users with the other role are sent to their own home. */
  role?: "Founder" | "Investor"
}

export default function RequireAuth({ children, role }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)

  const wrongRole = Boolean(user && role && user.role !== role)

  useEffect(() => {
    // Only redirect once — prevents the loop caused by repeated re-renders
    if (loading || redirected.current) return
    if (!user) {
      redirected.current = true
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`)
    } else if (wrongRole) {
      redirected.current = true
      router.replace(homeFor(user.role))
    }
  }, [loading, user, wrongRole]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset once the user is valid again (e.g. after logging in from another tab)
  useEffect(() => {
    if (user && !wrongRole) redirected.current = false
  }, [user, wrongRole])

  if (loading || !user || wrongRole) return null

  return <>{children}</>
}
