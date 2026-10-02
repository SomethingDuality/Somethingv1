"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { X } from "lucide-react"
import { Creature } from "@/components/creature/creature"
import { useSomethingBox } from "./provider"

// The panel (the conversation, the answer inputs) is only drawn while the box is open, so it
// loads on its own: when the page is idle, or as soon as the pointer or focus reaches the orb.
const loadPanel = () => import("./panel")
const Panel = dynamic(() => loadPanel().then((m) => m.Panel), { ssr: false })
const warmPanel = () => {
  loadPanel().catch(() => {}) // offline: opening the box tries again
}

const PEEK_KEY = "something-box:peek-hidden"

const readHidden = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(PEEK_KEY) || "[]")
  } catch {
    return []
  }
}

/**
 * The orb (bottom-right) and its panel, a short conversation with Something; the panel is a
 * bottom sheet on phones. When a question is waiting, the creature holds up its diamond and, on
 * laptops, its first words peek out beside the orb.
 */
export function SomethingBox() {
  const box = useSomethingBox()
  const { question: q, open, setOpen } = box
  const orbRef = useRef<HTMLButtonElement>(null)
  const [hidden, setHidden] = useState<string[]>([])

  useEffect(() => setHidden(readHidden()), [])

  // Fetch the panel once the page has settled, so the first open doesn't wait for it.
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warmPanel, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(warmPanel, 3000)
    return () => clearTimeout(t)
  }, [])

  const waiting = Boolean(q) && !open
  const peekKey = q ? `${q.id}:${q.entityId ?? ""}` : ""
  const peek = waiting && !hidden.includes(peekKey)

  const hidePeek = () => {
    const next = [...hidden, peekKey].slice(-50)
    setHidden(next)
    try {
      sessionStorage.setItem(PEEK_KEY, JSON.stringify(next))
    } catch {
      // Not remembered across reloads; fine.
    }
  }

  const close = () => {
    setOpen(false)
    orbRef.current?.focus()
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
        {peek && q && (
          <div className="hidden h-11 max-w-[320px] items-center rounded-full border border-line bg-surface-2 pl-4 pr-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)] sm:flex">
            <button type="button" onClick={() => setOpen(true)} className="min-w-0 truncate text-[15px] text-foreground cursor-pointer">
              {q.prompt}
            </button>
            <button
              type="button"
              onClick={hidePeek}
              aria-label="Hide this question"
              className="ml-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <button
          ref={orbRef}
          type="button"
          onClick={() => setOpen(!open)}
          onPointerEnter={warmPanel}
          onFocus={warmPanel}
          aria-label={waiting ? "Something has a question for you" : open ? "Close Something" : "Open Something"}
          aria-expanded={open}
          className="flex size-14 items-center justify-center rounded-full border border-line bg-surface-2 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-colors hover:border-muted-foreground cursor-pointer"
        >
          <Creature size={32} holding={waiting} />
        </button>
      </div>

      {open && <Panel onClose={close} />}
    </>
  )
}
