"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import RequireAuth from "@/components/require-auth"
import { homeFor, useAuth } from "@/components/auth-provider"
import { Wordmark, useInteriorTheme } from "@/components/shell/app-shell"
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

/**
 * Admin: investor verification (P13). Each request is a LinkedIn link to check by hand, then
 * Verify or Decline (a decline needs a reason the investor will see). Only the emails in the
 * API's ADMIN_EMAILS can open this; anyone else gets "not found".
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
    <div className="min-h-dvh bg-background text-foreground px-5 pt-8 pb-24 md:px-12 lg:px-16">
      <Wordmark href={homeFor(user?.role)} />
      <Page className="mt-16">
        {!user?.isAdmin ? (
          <PageTitle title="Not found">
            This page doesn&apos;t exist. <Link href={homeFor(user?.role)} className="text-foreground underline underline-offset-4">Go home</Link>
          </PageTitle>
        ) : (
          <>
            <PageTitle title="Investor verification">
              Check each LinkedIn by hand. Verified investors show as &ldquo;verified investor&rdquo; to founders.
            </PageTitle>
            <div className="mt-10 flex gap-6" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn("text-[15px] transition-colors cursor-pointer", tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {t.label}
                </button>
              ))}
            </div>
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
        )}
      </Page>
    </div>
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
