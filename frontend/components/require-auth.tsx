"use client"

import React, { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { homeFor, useAuth } from "./auth-provider"
import { quietLinkClass } from "@/components/shell/page"

type Props = {
  children: React.ReactNode
  /** When set, users with the other role are sent to their own home. */
  role?: "Founder" | "Investor"
}

export default function RequireAuth({ children, role }: Props) {
  const { user, loading, unreachable, refreshMe } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)

  const wrongRole = Boolean(user && role && user.role !== role)

  useEffect(() => {
    // Only redirect once — prevents the loop caused by repeated re-renders
    if (loading || redirected.current) return
    if (!user) {
      if (unreachable) return // not signed out, just not reachable: the retry below
      redirected.current = true
      // The query too, so a deep link (?thread=…) survives signing in.
      router.replace(`/login?next=${encodeURIComponent((pathname || "/") + window.location.search)}`)
    } else if (wrongRole) {
      redirected.current = true
      router.replace(homeFor(user.role))
    }
  }, [loading, user, wrongRole, unreachable]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset once the user is valid again (e.g. after logging in from another tab)
  useEffect(() => {
    if (user && !wrongRole) redirected.current = false
  }, [user, wrongRole])

  // Offline or the server failing is not being signed out: say so and try again, don't send them to sign in.
  useEffect(() => {
    if (loading || user || !unreachable) return
    const online = () => { refreshMe() }
    window.addEventListener("online", online)
    return () => window.removeEventListener("online", online)
  }, [loading, user, unreachable, refreshMe])

  if (!loading && !user && unreachable) {
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-[15px] text-muted-foreground">Couldn&apos;t connect. Check your connection and try again.</p>
        <button type="button" onClick={() => refreshMe()} className={quietLinkClass}>Retry</button>
      </div>
    )
  }
  if (loading || !user || wrongRole) return null

  return <>{children}</>
}
