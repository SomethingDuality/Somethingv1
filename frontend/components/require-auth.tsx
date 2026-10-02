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
  const { user, loading, checked, unreachable, refreshMe, ensureChecked } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)

  // /auth/me has answered; before that `user` is only the last one this tab confirmed.
  const confirmed = checked && !loading
  const wrongRole = Boolean(user && role && user.role !== role)

  // A public page may have skipped /auth/me (nobody had signed in on this browser): ask now.
  useEffect(() => ensureChecked(), [ensureChecked])

  useEffect(() => {
    // Only redirect once — prevents the loop caused by repeated re-renders
    if (!confirmed || redirected.current) return
    if (!user) {
      if (unreachable) return // not signed out, just not reachable: the retry below
      redirected.current = true
      // The query too, so a deep link (?thread=…) survives signing in.
      router.replace(`/login?next=${encodeURIComponent((pathname || "/") + window.location.search)}`)
    } else if (wrongRole) {
      redirected.current = true
      router.replace(homeFor(user.role))
    }
  }, [confirmed, user, wrongRole, unreachable]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset once the user is valid again (e.g. after logging in from another tab)
  useEffect(() => {
    if (user && !wrongRole) redirected.current = false
  }, [user, wrongRole])

  // Offline or the server failing is not being signed out: say so and try again, don't send them to sign in.
  useEffect(() => {
    if (!confirmed || user || !unreachable) return
    const online = () => { refreshMe() }
    window.addEventListener("online", online)
    return () => window.removeEventListener("online", online)
  }, [confirmed, user, unreachable, refreshMe])

  if (confirmed && !user && unreachable) {
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-[15px] text-muted-foreground">Couldn&apos;t connect. Check your connection and try again.</p>
        <button type="button" onClick={() => refreshMe()} className={quietLinkClass}>Retry</button>
      </div>
    )
  }
  // The last user this tab confirmed, with this page's role, gets the page at once; anyone else
  // waits for /auth/me.
  if (!user || wrongRole) return null

  return <>{children}</>
}
