"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

type GoogleId = {
  initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

type Props = {
  onCredential: (credential: string) => void
  text?: "continue_with" | "signin_with" | "signup_with"
}

/**
 * "Continue with Google" via Google Identity Services. Renders nothing until
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, so local dev works without a Google client.
 */
export function GoogleSignInButton({ onCredential, text = "continue_with" }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const callback = useRef(onCredential)
  callback.current = onCredential

  useEffect(() => {
    if (typeof window !== "undefined" && window.google) setLoaded(true)
  }, [])

  useEffect(() => {
    if (!CLIENT_ID || !loaded || !ref.current || !window.google) return
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (r) => callback.current(r.credential),
    })
    window.google.accounts.id.renderButton(ref.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text,
      width: ref.current.offsetWidth || 320,
    })
  }, [loaded, text])

  if (!CLIENT_ID) return null

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setLoaded(true)} />
      <div ref={ref} className="w-full flex justify-center min-h-[44px]" />
    </>
  )
}

export const googleSignInEnabled = Boolean(CLIENT_ID)

/** "or" divider shown between Google and the email form when Google is enabled. */
export function OrDivider() {
  if (!CLIENT_ID) return null
  return (
    <p className="text-sm text-muted-foreground">or</p>
  )
}
