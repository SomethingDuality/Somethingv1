"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import RequireAuth from "@/components/require-auth"
import { homeFor, useAuth } from "@/components/auth-provider"
import { Wordmark, useInteriorTheme } from "@/components/shell/wordmark"
import { Page, PageTitle, Section, pillClass, quietLinkClass, relativeTime } from "@/components/shell/page"
import { apiError, cn } from "@/lib/utils"
import { SkeletonRows } from "@/components/visual/skeleton"

type Request = {
  userId: string
  name: string
  email: string
  firm: string
  linkedin: string
  status: "pending" | "verified" | "rejected"
  submittedAt: string | null
  reviewedAt: string | null
  note: string
}

const TABS = [
  { id: "pending", label: "Waiting" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Declined" },
] as const

const AREAS = [
  { id: "moderation", label: "Moderation" },
  { id: "verification", label: "Investor verification" },
] as const

/**
 * Admin, in two parts. Moderation (C1): hidden, reported and word-flagged posts, to restore,
 * approve or remove. Investor verification (P13): a LinkedIn link to check by hand, then Verify
 * or Decline (a decline needs a reason the investor will see). Only the emails in the API's
 * ADMIN_EMAILS can open this; anyone else gets "not found".
 */
export default function AdminPage() {
  useInteriorTheme()
  return (
    <RequireAuth>
      <AdminInner />
    </RequireAuth>
  )
}

function AdminInner() {
  const { user } = useAuth()
  const [area, setArea] = useState<(typeof AREAS)[number]["id"]>("moderation")

  return (
    <div className="min-h-dvh bg-background text-foreground px-5 pt-8 pb-24 md:px-12 lg:px-16">
      <Wordmark href={homeFor(user?.role)} />
      <Page className="mt-16">
        {!user?.isAdmin ? (
          <PageTitle title="Not found">
            This page doesn&apos;t exist. <Link href={homeFor(user?.role)} className="text-foreground underline underline-offset-4">Go home</Link>
          </PageTitle>
        ) : (
          <>
            <PageTitle title="Admin">Keep the community safe, and check investors who ask to be verified.</PageTitle>
            <Tabs tabs={AREAS} value={area} onChange={setArea} className="mt-10 text-lg" label="Admin areas" />
            {area === "moderation" ? <Moderation role={user.role} /> : <Verification />}
          </>
        )}
      </Page>
    </div>
  )
}

function Tabs<T extends string>({ tabs, value, onChange, className, label }: {
  tabs: readonly { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  label: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-6 gap-y-2", className)} role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn("transition-colors cursor-pointer", value === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Verification() {
  const { user } = useAuth()
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending")
  const [rows, setRows] = useState<Request[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setRows(null)
    try {
      setRows((await apiClient.get<Request[]>(`/admin/verifications?status=${tab}`)).data)
    } catch (err) {
      setRows([])
      setError(apiError(err, "Couldn't load requests."))
    }
  }, [tab])

  useEffect(() => {
    if (user?.isAdmin) load()
  }, [user?.isAdmin, load])

  return (
    <>
      <p className="mt-8 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
        Check each LinkedIn by hand. Verified investors show as &ldquo;verified investor&rdquo; to founders.
      </p>
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mt-6 text-[15px]" label="Requests" />
      <Section className="mt-8">
        {error ? (
          <p role="alert" className="text-[15px] text-destructive">{error}</p>
        ) : rows === null ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">{tab === "pending" ? "Nobody is waiting." : "None yet."}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {rows.map((r) => <RequestRow key={r.userId} r={r} onDone={load} />)}
          </ul>
        )}
      </Section>
    </>
  )
}

function RequestRow({ r, onDone }: { r: Request; onDone: () => void }) {
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const decide = async (decision: "verify" | "reject") => {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/admin/verifications/${r.userId}`, { decision, ...(decision === "reject" ? { note: note.trim() } : {}) })
      onDone()
    } catch (err) {
      setError(apiError(err, "That didn't save."))
      setBusy(false)
    }
  }

  return (
    <li className="py-6 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-baseline xl:gap-x-10">
      <div className="min-w-0">
        <p className="text-lg">{r.name}{r.firm && <span className="text-muted-foreground">, {r.firm}</span>}</p>
        <p className="mt-1 flex flex-wrap gap-x-5 text-sm text-muted-foreground">
          <span>{r.email}</span>
          {r.linkedin && <a href={r.linkedin} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">LinkedIn</a>}
          {r.submittedAt && <span>Asked {relativeTime(r.submittedAt)}</span>}
          {r.status === "rejected" && r.note && <span>Declined: {r.note}</span>}
        </p>
        {declining && (
          <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) decide("reject") }} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Why it's declined"
              value={note}
              maxLength={300}
              autoFocus
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why, so they know what to fix"
              className="h-10 w-full shrink-0 sm:w-auto sm:flex-1 rounded-full border border-input bg-transparent px-5 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
            />
            <button type="submit" disabled={busy || !note.trim()} className={pillClass}>Decline</button>
          </form>
        )}
        {error && <p role="alert" className="mt-2 text-[15px] text-destructive">{error}</p>}
      </div>
      {r.status === "pending" && !declining && (
        <div className="mt-4 flex items-center gap-5 xl:mt-0">
          <button type="button" disabled={busy} onClick={() => decide("verify")} className={pillClass}>Verify</button>
          <button type="button" disabled={busy} onClick={() => setDeclining(true)} className={quietLinkClass}>Decline</button>
        </div>
      )}
    </li>
  )
}

/* ─── Moderation (C1) ───────────────────────────────────────────────────────── */

type QueueItem = {
  type: "idea" | "comment" | "problem" | "message"
  id: string
  /** Where it lives: an idea page, the problems board opened on that problem, or a private chat. */
  place: { kind: "idea" | "problem" | "chat"; id: string; title: string }
  text: string
  author: string
  anonymous: boolean
  state: "visible" | "hidden" | "removed" | "approved"
  reportCount: number
  needsReview: boolean
  flaggedTerms: string[]
  reasons: Record<string, number>
  notes: string[]
  createdAt: string
}

const VIEWS = [
  { id: "hidden", label: "Hidden", empty: "Nothing is hidden." },
  { id: "reported", label: "Reported", empty: "Nothing reported that's still up." },
  { id: "review", label: "Flagged words", empty: "Nothing flagged by the word filter." },
] as const

const REASON_LABELS: Record<string, string> = {
  spam: "Spam", scam: "Scam", harassment: "Harassment", off_topic: "Off-topic", personal_info: "Personal info", other: "Something else",
}

function Moderation({ role }: { role?: string }) {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("hidden")
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setItems(null)
    try {
      setItems((await apiClient.get<QueueItem[]>(`/admin/moderation?view=${view}`)).data)
    } catch (err) {
      setItems([])
      setError(apiError(err, "Couldn't load the queue."))
    }
  }, [view])

  useEffect(() => { load() }, [load])

  return (
    <>
      <p className="mt-8 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
        Reports hide an idea at 5 and a comment at 3 until you look. Approve keeps a post up for good; Restore puts it back and starts the count again.
      </p>
      <Tabs tabs={VIEWS} value={view} onChange={setView} className="mt-6 text-[15px]" label="Queue" />
      <Section className="mt-8">
        {error ? (
          <p role="alert" className="text-[15px] text-destructive">{error}</p>
        ) : items === null ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">{VIEWS.find((v) => v.id === view)?.empty}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {items.map((it) => <QueueRow key={`${it.type}:${it.id}`} item={it} role={role} onDone={load} />)}
          </ul>
        )}
      </Section>
    </>
  )
}

function QueueRow({ item, role, onDone }: { item: QueueItem; role?: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const r = String(role).toLowerCase() === "investor" ? "investor" : "founder"
  // Chats are private: an admin reads only the reported message here, never the conversation.
  const href = item.place.kind === "chat" ? null
    : item.place.kind === "problem" ? `/${r}/problems?p=${item.place.id}`
    : r === "investor" ? `/investor/search/${item.place.id}` : `/founder/ideas/${item.place.id}`
  const what = item.type === "idea" ? <>Idea</>
    : item.type === "problem" ? <>Problem</>
    : item.type === "message" ? <>Message in a private chat</>
    : item.place.kind === "problem" ? <>Reply to &ldquo;{item.place.title}&rdquo;</>
    : <>Comment on &ldquo;{item.place.title}&rdquo;</>
  const reasons = Object.entries(item.reasons).sort((a, b) => b[1] - a[1])

  const act = async (action: "restore" | "approve" | "remove") => {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/admin/moderation/${item.type}/${item.id}`, { action })
      onDone()
    } catch (err) {
      setError(apiError(err, "That didn't save."))
      setBusy(false)
    }
  }

  return (
    <li className="py-6 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-x-10">
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">
          {what} by <span className="text-foreground">{item.author}</span>{item.anonymous && " (posted without a name)"}, {relativeTime(item.createdAt)}
          {item.state === "hidden" && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-foreground">Hidden</span>}
        </p>
        <p className="mt-2 line-clamp-6 max-w-[65ch] whitespace-pre-line text-[15px] leading-relaxed">{item.text}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
          {item.reportCount > 0 && (
            <span>
              {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
              {reasons.length > 0 && `: ${reasons.map(([r, n]) => `${REASON_LABELS[r] ?? r}${n > 1 ? ` ${n}` : ""}`).join(", ")}`}
            </span>
          )}
          {item.flaggedTerms.length > 0 && <span>Flagged: {item.flaggedTerms.join(", ")}</span>}
          {href && <Link href={href} className="text-foreground underline underline-offset-4">Open</Link>}
        </div>
        {item.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
            {item.notes.map((n, i) => <li key={i}>&ldquo;{n}&rdquo;</li>)}
          </ul>
        )}
        {error && <p role="alert" className="mt-2 text-[15px] text-destructive">{error}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-5 xl:mt-0">
        {confirmRemove ? (
          <>
            <span className="text-[15px]">Remove for good?</span>
            <button type="button" disabled={busy} onClick={() => act("remove")} className={pillClass}>Remove</button>
            <button type="button" disabled={busy} onClick={() => setConfirmRemove(false)} className={quietLinkClass}>Cancel</button>
          </>
        ) : (
          <>
            {item.state === "hidden" ? (
              <button type="button" disabled={busy} onClick={() => act("restore")} className={pillClass}>Restore</button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => act("approve")} className={item.state === "hidden" ? quietLinkClass : pillClass}>Approve</button>
            <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className={quietLinkClass}>Remove</button>
          </>
        )}
      </div>
    </li>
  )
}
