"use client"

import React, { useEffect, useState } from "react"
import { getFeedback, type FeedbackEvent } from "@/lib/mutiny-feedback"

export default function FeedbackPanel() {
  const [items, setItems] = useState<FeedbackEvent[]>(() => getFeedback())

  useEffect(() => {
    const handler = () => {
      setItems(getFeedback())
    }
    window.addEventListener('mutiny:feedback', handler)
    return () => window.removeEventListener('mutiny:feedback', handler)
  }, [])

  if (!items.length) return <div className="text-xs text-white/60">No feedback yet.</div>

  return (
    <div className="bg-white/4 border border-white/6 rounded-md p-3 text-sm">
      <div className="font-medium mb-2">Feedback (dev log)</div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {items.slice().reverse().map((it: FeedbackEvent) => (
          <div key={it.id} className="text-xs text-white/70">{new Date(it.timestamp).toLocaleString()} — <strong className="text-white">{it.type}</strong> {it.targetType} {it.targetId}</div>
        ))}
      </div>
    </div>
  )
}
