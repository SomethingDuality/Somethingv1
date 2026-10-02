"use client"

import { useCallback, useEffect, useRef } from "react"

/**
 * Calls `fn` every `intervalMs` while the tab is visible (and once when it becomes visible
 * again). Never two calls at once; after a failure it waits twice as long (up to 5 minutes);
 * a 401 stops it, since the session is over. Chats (community C5) reuse this.
 *
 * With `idleMaxMs`, a call that resolves `false` (nothing new) makes the next wait 1.5 times
 * longer, up to `idleMaxMs`; anything else goes back to `intervalMs`. The returned `wake()`
 * also goes back to `intervalMs` (after a send, say). It never changes.
 */
export function usePoll(
  fn: () => Promise<void | boolean>,
  intervalMs: number,
  { enabled = true, idleMaxMs }: { enabled?: boolean; idleMaxMs?: number } = {},
): () => void {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const wakeRef = useRef(() => {})

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
        const news = await fnRef.current()
        delay = idleMaxMs && news === false ? Math.min(Math.round(delay * 1.5), idleMaxMs) : intervalMs
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

    wakeRef.current = () => {
      delay = intervalMs
      if (!inFlight) schedule()
    }

    schedule()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      wakeRef.current = () => {}
    }
  }, [intervalMs, enabled, idleMaxMs])

  return useCallback(() => wakeRef.current(), [])
}
