"use client"

import { useCallback, useEffect, useState } from "react"
import apiClient from "@/lib/axios"
import { Section, pillClass, quietLinkClass, relativeTime } from "@/components/shell/page"
import { apiError } from "@/lib/utils"
import { SkeletonRows } from "@/components/visual/skeleton"

export type Update = { id: string; text: string; createdAt: string }

const MAX = 1000

/** The updates request on its own, so a page can start it together with the idea. */
export const fetchUpdates = (ideaId: string) => apiClient.get<Update[]>(`/ideas/${ideaId}/updates`).then((r) => r.data)

/**
 * The founder's updates on an idea, newest first. The owner gets a one-line composer; posting
 * tells every investor who saved or committed to the idea. `request` is the page's fetchUpdates
 * call, started with the idea; without one it asks itself.
 */
export function IdeaUpdates({ ideaId, isOwner, request }: { ideaId: string; isOwner: boolean; request?: Promise<Update[]> }) {
  const [updates, setUpdates] = useState<Update[] | null>(null)
  const [text, setText] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setUpdates(await (request ?? fetchUpdates(ideaId)))
    } catch {
      setUpdates([])
    }
  }, [ideaId, request])

  useEffect(() => { load() }, [load])

  const post = async () => {
    const t = text.trim()
    if (!t || posting) return
    setPosting(true)
    setError(null)
    try {
      const res = await apiClient.post<Update>(`/ideas/${ideaId}/updates`, { text: t })
      setUpdates((u) => [res.data, ...(u ?? [])])
      setText("")
    } catch (err) {
      setError(apiError(err, "Couldn't post the update."))
    } finally {
      setPosting(false)
    }
  }

  const remove = async (id: string) => {
    const before = updates
    setUpdates((u) => (u ?? []).filter((x) => x.id !== id))
    try {
      await apiClient.delete(`/ideas/${ideaId}/updates/${id}`)
    } catch (err) {
      setUpdates(before)
      setError(apiError(err, "Couldn't delete the update."))
    }
  }

  if (!isOwner && updates !== null && updates.length === 0) return null

  return (
    <Section title="Updates">
      {isOwner && (
        <form onSubmit={(e) => { e.preventDefault(); post() }} className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Write an update"
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="What changed? Investors following this idea are told."
            className="h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-full border border-input bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
          />
          <button type="submit" disabled={!text.trim() || posting} className={pillClass}>{posting ? "Posting…" : "Post update"}</button>
        </form>
      )}
      {error && <p role="alert" className="mb-4 text-[15px] text-destructive">{error}</p>}
      {updates === null ? (
        <SkeletonRows />
      ) : updates.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">No updates yet.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {updates.map((u) => (
            <li key={u.id} className="py-4">
              <p className="max-w-[65ch] whitespace-pre-line text-[15px] leading-relaxed">{u.text}</p>
              <p className="mt-1.5 flex gap-5 text-xs text-muted-foreground">
                <span>{relativeTime(u.createdAt)}</span>
                {isOwner && <button type="button" onClick={() => remove(u.id)} className={`${quietLinkClass} text-xs`}>Delete</button>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
