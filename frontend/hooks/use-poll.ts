"use client"

import { useEffect, useRef } from "react"

/**
 * Calls `fn` every `intervalMs` while the tab is visible (and once when it becomes visible
 * again). Never two calls at once; after a failure it waits twice as long (up to 5 minutes);
 * a 401 stops it, since the session is over. Chats (community C5) reuse this.
 */
export function usePoll(fn: () => Promise<void>, intervalMs: number, { enabled = true }: { enabled?: boolean } = {}) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let inFlight = false
    let stopped = false
    let delay = intervalMs

    const schedule = () => {
      clearTimeout(timer)
      if (!stopped) timer = setTimeout(tick, delay)
    }

    const tick = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return schedule()
      inFlight = true
      try {
        await fnRef.current()
        delay = intervalMs
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 401) stopped = true
        delay = Math.min(delay * 2, 5 * 60 * 1000)
      } finally {
        inFlight = false
        schedule()
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }

    schedule()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [intervalMs, enabled])
}
