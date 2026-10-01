"use client"

import { useEffect, useState } from "react"
import apiClient from "@/lib/axios"
import { toast } from "@/components/ui/use-toast"
import { apiError, cn } from "@/lib/utils"

type State = { supported: boolean; count: number }

/**
 * Support an idea (upvote only: the community plan has no downvotes on ideas). It flips at once
 * and goes back if the server says no. Founders never see who supported, only how many, and
 * are told at the 1st, 10th, 25th… supporter. Not shown on your own idea.
 */
export function SupportButton({
  ideaId,
  supported = false,
  count = 0,
  size = "md",
  onChange,
  className,
}: {
  ideaId: string
  supported?: boolean
  count?: number
  size?: "sm" | "md"
  onChange?: (next: State) => void
  className?: string
}) {
  const [state, setState] = useState<State>({ supported, count })
  const [busy, setBusy] = useState(false)

  useEffect(() => setState({ supported, count }), [supported, count])

  const toggle = async () => {
    if (busy) return
    const before = state
    const optimistic = { supported: !before.supported, count: Math.max(0, before.count + (before.supported ? -1 : 1)) }
    setState(optimistic)
    setBusy(true)
    try {
      const res = before.supported
        ? await apiClient.delete<{ likes: number; supportedByMe: boolean }>(`/ideas/${ideaId}/like`)
        : await apiClient.post<{ likes: number; supportedByMe: boolean }>(`/ideas/${ideaId}/like`, {})
      const settled = { supported: res.data.supportedByMe ?? optimistic.supported, count: res.data.likes ?? optimistic.count }
      setState(settled)
      onChange?.(settled)
    } catch (err) {
      setState(before)
      toast({
        title: before.supported ? "Support not removed" : "Support not saved",
        description: apiError(err, "Please try again."),
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state.supported}
      aria-label={`${state.supported ? "Supported" : "Support"}, ${state.count} ${state.count === 1 ? "supporter" : "supporters"}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border transition-colors cursor-pointer",
        size === "sm" ? "px-3 py-1 text-xs" : "h-10 px-5 text-[15px]",
        state.supported ? "border-foreground/60 text-foreground" : "border-line text-muted-foreground hover:border-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {state.supported ? "Supported" : "Support"}
      {state.count > 0 && <span className="tabular-nums text-muted-foreground">{state.count}</span>}
    </button>
  )
}
