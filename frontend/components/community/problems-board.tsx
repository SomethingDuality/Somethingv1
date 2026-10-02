"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronUp } from "lucide-react"
import apiClient from "@/lib/axios"
import { Aside, Main, Page, PageTitle, Section, Split, pillClass, quietLinkClass } from "@/components/shell/page"
import { ReportButton } from "@/components/community/report-dialog"
import { LeaderboardCard } from "@/components/community/leaderboard-card"
import { SkeletonRows } from "@/components/visual/skeleton"
import { toast } from "@/components/ui/use-toast"
import { ideaPalettes } from "@/lib/visual"
import { labelFor, options } from "@/lib/taxonomy"
import { purgeLegacyStorage } from "@/lib/local-keys"
import { when } from "@/lib/format"
import { apiError, cn } from "@/lib/utils"

type Hidden = "hidden" | "removed"

export type Problem = {
  id: string
  text: string
  tags: string[]
  createdAt: string
  upvotes: number
  downvotes: number
  score: number
  commentsCount: number
  anonymous: boolean
  author: { name: string; role: "Founder" | "Investor" } | null
  isMine: boolean
  myVote: -1 | 0 | 1
  hidden?: Hidden
}

type Reply = {
  id: string
  text: string
  createdAt: string
  anonymous: boolean
  author: string | null
  isMine: boolean
  hidden?: Hidden
}

const MAX_TEXT = 280
const MAX_TAGS = 3
const SORTS = [
  { id: "new", label: "New" },
  { id: "week", label: "Top this week" },
  { id: "all", label: "Top all time" },
] as const
type Sort = (typeof SORTS)[number]["id"]

const chip = (on: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors cursor-pointer",
    on ? "border-foreground bg-foreground text-background" : "border-line text-muted-foreground hover:border-muted-foreground hover:text-foreground",
  )

const SectorDot = ({ id }: { id: string }) => (
  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: ideaPalettes([id])[0][1] }} aria-hidden="true" />
)

/**
 * The problems board (community C3), the same for founders and investors: short posts about
 * real problems, voted up or down, with replies. Anyone can post or reply without their name.
 * `?p=<id>` opens one problem on top (notifications and copied links use it).
 */
export function ProblemsBoard({ role }: { role: "founder" | "investor" }) {
  const router = useRouter()
  const params = useSearchParams()
  const linkedId = params.get("p")

  const [sort, setSort] = useState<Sort>("new")
  const [tag, setTag] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [q, setQ] = useState("")
  const [items, setItems] = useState<Problem[] | null>(null)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState<Problem | null>(null)
  const [trending, setTrending] = useState<{ id: string; count: number }[]>([])

  // The old board lived in this browser; its sample posts and votes go now.
  useEffect(() => purgeLegacyStorage(), [])

  // Search as you type, without a request per key.
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const url = useCallback((page: number) => {
    const qs = new URLSearchParams({
      sort: sort === "new" ? "new" : "top",
      window: sort === "week" ? "week" : "all",
      page: String(page),
    })
    if (tag) qs.set("tag", tag)
    if (q) qs.set("q", q)
    return `/problems?${qs}`
  }, [sort, tag, q])

  // Each new search or filter bumps this; an answer to an older one arriving late is dropped.
  const request = useRef(0)

  const load = useCallback(async () => {
    const mine = ++request.current
    setError(null)
    setItems(null)
    try {
      const res = await apiClient.get<{ problems: Problem[]; nextPage: number | null }>(url(1))
      if (mine !== request.current) return
      setItems(res.data.problems)
      setNextPage(res.data.nextPage)
    } catch (err) {
      if (mine !== request.current) return
      setItems([])
      setError(apiError(err, "Couldn't load problems."))
    }
  }, [url])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    if (!nextPage) return
    const mine = request.current
    setLoadingMore(true)
    try {
      const res = await apiClient.get<{ problems: Problem[]; nextPage: number | null }>(url(nextPage))
      if (mine !== request.current) return // the search changed meanwhile
      setItems((cur) => [...(cur ?? []), ...res.data.problems.filter((p) => !(cur ?? []).some((c) => c.id === p.id))])
      setNextPage(res.data.nextPage)
    } catch (err) {
      toast({ title: "Couldn't load more", description: apiError(err, "Please try again."), variant: "destructive" })
    } finally {
      setLoadingMore(false)
    }
  }

  const loadTrending = useCallback(() => {
    apiClient.get<{ id: string; count: number }[]>("/problems/trending-tags").then((r) => setTrending(r.data)).catch(() => setTrending([]))
  }, [])
  useEffect(() => { loadTrending() }, [loadTrending])

  useEffect(() => {
    if (!linkedId) { setLinked(null); return }
    apiClient.get<Problem>(`/problems/${linkedId}`)
      .then((r) => setLinked(r.data))
      .catch(() => {
        setLinked(null)
        toast({ title: "That problem isn't available", description: "It may have been deleted." })
      })
  }, [linkedId])

  const replace = (p: Problem) => {
    setItems((cur) => cur?.map((x) => (x.id === p.id ? p : x)) ?? cur)
    setLinked((cur) => (cur?.id === p.id ? p : cur))
  }
  const remove = (id: string) => {
    setItems((cur) => cur?.filter((x) => x.id !== id) ?? cur)
    if (linked?.id === id) router.replace(`/${role}/problems`)
    loadTrending()
  }
  const posted = (p: Problem) => {
    if (sort === "new" && !tag && !q) setItems((cur) => [p, ...(cur ?? [])])
    else load()
    loadTrending()
  }

  const cardProps = { role, onChange: replace, onDeleted: remove, onTag: setTag }

  return (
    <Page>
      <PageTitle title="Problems">
        Real problems worth solving. Say it in a sentence or two, vote on others, and reply with how you&apos;d solve it.
      </PageTitle>

      <Split className="mt-10">
        <Main>
          <Composer onPosted={posted} />

          {linked && (
            <section className="mt-12" aria-label="Linked problem">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[13px] text-muted-foreground">The problem you opened</p>
                <button type="button" onClick={() => router.replace(`/${role}/problems`)} className="text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">
                  Close
                </button>
              </div>
              <ul className="mt-2 border-y border-border">
                <ProblemCard p={linked} startOpen {...cardProps} />
              </ul>
            </section>
          )}

          <div className="mt-12 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-x-6 gap-y-2" role="tablist" aria-label="Sort">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={sort === s.id}
                  onClick={() => setSort(s.id)}
                  className={cn("text-[15px] transition-colors cursor-pointer", sort === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 100))}
              placeholder="Search problems"
              aria-label="Search problems"
              className="h-10 w-full rounded-full border border-line bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none lg:w-64 lg:text-[15px]"
            />
          </div>

          {tag && (
            <p className="mt-4 flex items-center gap-3 text-[15px] text-muted-foreground">
              In <span className="inline-flex items-center gap-1.5 text-foreground"><SectorDot id={tag} />{labelFor("sectors", tag)}</span>
              <button type="button" onClick={() => setTag(null)} className="text-[13px] underline-offset-4 hover:text-foreground hover:underline cursor-pointer">
                Show all
              </button>
            </p>
          )}

          <div className="mt-6">
            {error ? (
              <div role="alert" className="flex items-baseline gap-5">
                <p className="text-[15px] text-destructive">{error}</p>
                <button type="button" onClick={load} className={quietLinkClass}>Retry</button>
              </div>
            ) : items === null ? (
              <SkeletonRows />
            ) : items.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">
                {q || tag ? "Nothing matches. Try another search or sector." : sort === "week" ? "Nothing posted this week yet." : "No problems yet. Be the first to post one."}
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {items.filter((p) => p.id !== linked?.id).map((p) => <ProblemCard key={p.id} p={p} {...cardProps} />)}
              </ul>
            )}
            {nextPage && (
              <button type="button" onClick={loadMore} disabled={loadingMore} className={cn(quietLinkClass, "mt-6")}>
                {loadingMore ? "Loading…" : "Show more"}
              </button>
            )}
          </div>
        </Main>

        <Aside>
          <LeaderboardCard kind="problems" role={role} title="Top problems" className="mt-10 xl:mt-0" />
          <Section title="Trending sectors">
            {trending.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Nothing yet in the last two weeks.</p>
            ) : (
              <ul className="space-y-2.5">
                {trending.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-4">
                    <button type="button" onClick={() => setTag(t.id)} className="inline-flex items-center gap-2 text-[15px] text-foreground/90 underline-offset-4 hover:underline cursor-pointer">
                      <SectorDot id={t.id} />
                      {labelFor("sectors", t.id)}
                    </button>
                    <span className="text-[13px] text-muted-foreground tabular-nums">{t.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="How it works">
            <ul className="space-y-2 text-[15px] leading-relaxed text-muted-foreground">
              <li>Votes are private: nobody sees who voted.</li>
              <li>Post or reply without your name whenever you like.</li>
              <li>Report anything that breaks the rules. Three reports hide it until we look.</li>
            </ul>
          </Section>
        </Aside>
      </Split>
    </Page>
  )
}

/* ─── Posting ───────────────────────────────────────────────────────────────── */

function Composer({ onPosted }: { onPosted: (p: Problem) => void }) {
  const [text, setText] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [posting, setPosting] = useState(false)
  const sectors = options("sectors")

  const toggleTag = (id: string) =>
    setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length < MAX_TAGS ? [...t, id] : t))

  const post = async () => {
    const body = text.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const res = await apiClient.post<Problem>("/problems", { text: body, tags, anonymous })
      onPosted(res.data)
      setText("")
      setTags([])
      toast({ title: "Posted", description: anonymous ? "Without your name." : undefined })
    } catch (err) {
      // The text stays, so nothing typed is lost.
      toast({ title: "Not posted", description: apiError(err, "Please try again."), variant: "destructive" })
    } finally {
      setPosting(false)
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); post() }}
      className="rounded-[24px] border border-line bg-surface px-5 pb-4 pt-4 transition-colors focus-within:border-muted-foreground/60"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
        rows={2}
        aria-label="The problem"
        placeholder="What's a problem you keep running into?"
        className="block w-full resize-none bg-transparent text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[17px]"
      />
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Sectors, up to ${MAX_TAGS}`}>
        {sectors.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={tags.includes(s.value)}
            disabled={!tags.includes(s.value) && tags.length >= MAX_TAGS}
            onClick={() => toggleTag(s.value)}
            className={cn(chip(tags.includes(s.value)), "disabled:opacity-40 disabled:cursor-not-allowed")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <label className="inline-flex items-center gap-2.5 text-[15px] text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="size-4 accent-[var(--foreground)] cursor-pointer" />
          Post without my name
        </label>
        <div className="flex items-center gap-4">
          <span className={cn("text-[13px] tabular-nums", MAX_TEXT - text.length < 20 ? "text-foreground" : "text-muted-foreground")}>
            {MAX_TEXT - text.length}
          </span>
          <button type="submit" disabled={!text.trim() || posting} className={pillClass}>{posting ? "Posting…" : "Post"}</button>
        </div>
      </div>
    </form>
  )
}

/* ─── One problem ───────────────────────────────────────────────────────────── */

function ProblemCard({ p, role, startOpen = false, onChange, onDeleted, onTag }: {
  p: Problem
  role: "founder" | "investor"
  startOpen?: boolean
  onChange: (p: Problem) => void
  onDeleted: (id: string) => void
  onTag: (id: string) => void
}) {
  const [open, setOpen] = useState(startOpen)
  const [voting, setVoting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const vote = async (dir: 1 | -1) => {
    if (voting || p.isMine) return
    const value = p.myVote === dir ? 0 : dir
    const up = Number(value === 1) - Number(p.myVote === 1)
    const down = Number(value === -1) - Number(p.myVote === -1)
    const before = p
    onChange({ ...p, myVote: value as Problem["myVote"], upvotes: p.upvotes + up, downvotes: p.downvotes + down, score: p.score + value - p.myVote })
    setVoting(true)
    try {
      const res = await apiClient.put<{ upvotes: number; downvotes: number; score: number; myVote: Problem["myVote"] }>(`/problems/${p.id}/vote`, { value })
      onChange({ ...before, ...res.data })
    } catch (err) {
      onChange(before)
      toast({ title: "Vote not saved", description: apiError(err, "Please try again."), variant: "destructive" })
    } finally {
      setVoting(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/${role}/problems?p=${p.id}`)
    toast({ title: "Link copied" })
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await apiClient.delete(`/problems/${p.id}`)
      onDeleted(p.id)
      toast({ title: "Deleted", description: "With its votes and replies." })
    } catch (err) {
      setDeleting(false)
      toast({ title: "Not deleted", description: apiError(err, "Please try again."), variant: "destructive" })
    }
  }

  return (
    <li className="py-6">
      <p className="text-[13px] text-muted-foreground">
        {p.author ? <span className="text-foreground">{p.author.name}</span> : "Anonymous"}
        {p.author && <>, {p.author.role === "Investor" ? "investor" : "founder"}</>}
        {p.isMine && " (you)"} · {when(p.createdAt)}
      </p>
      {p.hidden && (
        <p className="mt-2 text-[13px] text-muted-foreground">
          {p.hidden === "hidden"
            ? "Only you can see this: it's hidden while we look at some reports."
            : "Only you can see this: it was removed because it breaks the community rules."}
        </p>
      )}
      <p className={cn("mt-2 max-w-[65ch] whitespace-pre-line text-base leading-relaxed sm:text-[17px]", p.hidden ? "text-muted-foreground" : "text-foreground")}>{p.text}</p>
      {p.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {p.tags.map((t) => (
            <button key={t} type="button" onClick={() => onTag(t)} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer">
              <SectorDot id={t} />
              {labelFor("sectors", t)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="inline-flex items-center rounded-full border border-line" role="group" aria-label={`Score ${p.score}`}>
          <button
            type="button"
            onClick={() => vote(1)}
            disabled={p.isMine}
            aria-pressed={p.myVote === 1}
            aria-label="Vote up"
            title={p.isMine ? "You can't vote on your own post" : "Vote up"}
            className={cn("grid size-9 place-items-center rounded-full transition-colors cursor-pointer disabled:cursor-default disabled:opacity-40", p.myVote === 1 ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <ChevronUp className={cn("size-4", p.myVote === 1 && "stroke-[3]")} />
          </button>
          <span className="min-w-6 text-center text-[13px] tabular-nums text-foreground">{p.score}</span>
          <button
            type="button"
            onClick={() => vote(-1)}
            disabled={p.isMine}
            aria-pressed={p.myVote === -1}
            aria-label="Vote down"
            title={p.isMine ? "You can't vote on your own post" : "Vote down"}
            className={cn("grid size-9 place-items-center rounded-full transition-colors cursor-pointer disabled:cursor-default disabled:opacity-40", p.myVote === -1 ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <ChevronDown className={cn("size-4", p.myVote === -1 && "stroke-[3]")} />
          </button>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">
          {open ? "Hide replies" : p.commentsCount === 1 ? "1 reply" : p.commentsCount > 0 ? `${p.commentsCount} replies` : "Reply"}
        </button>
        <button type="button" onClick={copyLink} className="text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Copy link</button>
        {!p.isMine && <ReportButton type="problem" id={p.id} className="text-[13px]" />}
        {p.isMine && (confirmDelete ? (
          <span className="inline-flex items-center gap-3 text-[13px]">
            Delete it with its replies?
            <button type="button" onClick={remove} disabled={deleting} className="text-foreground underline underline-offset-4 cursor-pointer">Delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Delete</button>
        ))}
      </div>

      {open && <Replies problem={p} onCount={(n) => onChange({ ...p, commentsCount: n })} />}
    </li>
  )
}

/* ─── Replies ───────────────────────────────────────────────────────────────── */

function Replies({ problem, onCount }: { problem: Problem; onCount: (n: number) => void }) {
  const [replies, setReplies] = useState<Reply[] | null>(null)
  const [text, setText] = useState("")
  const [anonymous, setAnonymous] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    apiClient.get<Reply[]>(`/problems/${problem.id}/comments`)
      .then((r) => setReplies(r.data))
      .catch(() => setReplies([]))
  }, [problem.id])

  const shownCount = (list: Reply[]) => list.filter((r) => !r.hidden).length

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await apiClient.post<Reply>(`/problems/${problem.id}/comments`, { text: body, anonymous })
      const next = [...(replies ?? []), res.data]
      setReplies(next)
      onCount(shownCount(next))
      setText("")
    } catch (err) {
      toast({ title: "Reply not posted", description: apiError(err, "Please try again."), variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await apiClient.delete(`/problems/comments/${id}`)
      const next = (replies ?? []).filter((r) => r.id !== id)
      setReplies(next)
      onCount(shownCount(next))
    } catch (err) {
      toast({ title: "Not deleted", description: apiError(err, "Please try again."), variant: "destructive" })
    }
  }

  return (
    <div className="mt-5 border-l border-line pl-5">
      {replies === null ? (
        <p className="text-[13px] text-muted-foreground">Loading replies…</p>
      ) : replies.length > 0 && (
        <ul className="space-y-4">
          {replies.map((r) => (
            <li key={r.id}>
              <p className="flex flex-wrap items-baseline gap-x-3 text-[13px] text-muted-foreground">
                <span>{r.author ? <span className="text-foreground">{r.author}</span> : "Anonymous"}{r.isMine && " (you)"} · {when(r.createdAt)}</span>
                {!r.isMine && !problem.isMine && <ReportButton type="comment" id={r.id} className="text-[13px]" />}
                {!r.isMine && problem.isMine && (
                  <>
                    <ReportButton type="comment" id={r.id} className="text-[13px]" />
                    <button type="button" onClick={() => remove(r.id)} className="hover:text-foreground cursor-pointer">Remove</button>
                  </>
                )}
                {r.isMine && <button type="button" onClick={() => remove(r.id)} className="hover:text-foreground cursor-pointer">Delete</button>}
              </p>
              <p className={cn("mt-1 max-w-[65ch] whitespace-pre-line text-[15px] leading-relaxed", r.hidden ? "text-muted-foreground" : "text-foreground/90")}>{r.text}</p>
              {r.hidden && (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {r.hidden === "hidden" ? "Only you can see this reply: it's hidden while we look at some reports." : "Only you can see this reply: it was removed."}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {!problem.hidden && (
        <form onSubmit={(e) => { e.preventDefault(); send() }} className={cn(replies?.length ? "mt-5" : "", "space-y-3")}>
          <div className="flex items-center gap-2 rounded-full border border-line py-1 pl-4 pr-1 focus-within:border-muted-foreground/60">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              placeholder="How would you solve it?"
              aria-label="Reply"
              className="h-9 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[15px]"
            />
            <button type="submit" disabled={!text.trim() || sending} className="h-9 shrink-0 rounded-full bg-foreground px-4 text-[13px] font-medium text-background transition-opacity disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed">
              {sending ? "Sending…" : "Reply"}
            </button>
          </div>
          <label className="inline-flex items-center gap-2.5 text-[13px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="size-3.5 accent-[var(--foreground)] cursor-pointer" />
            Reply without my name
          </label>
        </form>
      )}
    </div>
  )
}
