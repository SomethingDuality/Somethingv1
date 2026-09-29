"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { Aside, Main, Page, PageTitle, Section, Split, countOf, quietLinkClass, usd } from "@/components/shell/page"
import { FounderCardButton, type FounderCardData } from "@/components/founder-card"
import { ReleaseDialog, type ReleaseTarget } from "@/components/release-dialog"
import { IdeaCover } from "@/components/visual/idea-cover"
import { MilestoneMeter } from "@/components/visual/idea-card"
import { MoneyPanel } from "@/components/visual/money-panel"
import { apiError } from "@/lib/utils"
import { labelFor } from "@/lib/taxonomy"
import { SkeletonRows } from "@/components/visual/skeleton"
import { dateLabel } from "@/lib/format"

/** One investment, exactly as GET /investor/portfolio returns it. */
type Row = {
  id: string // the investment id
  ideaId: string
  name: string
  stage: string
  tags: string[]
  author: string
  founder: FounderCardData | null
  committed: number
  released: number
  status: string
  committed_at?: string
  releases: { amount: number; milestoneId: string | null; at: string }[]
  milestones: { id: string; title: string; status: "open" | "done"; doneAt: string | null }[]
}

type PortfolioResponse = { data: Row[]; totalCommitted: number; totalReleased: number }
type Saved = { _id: string; title: string; author?: string; stage?: string; tags?: string[] }

/**
 * The investor's pipeline, from real rows only: ideas they saved, money they committed, and
 * what they have released. Nothing moves money on Something yet; a release is a record.
 */
export default function InvestorInvestmentsPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [saved, setSaved] = useState<Saved[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [releasing, setReleasing] = useState<ReleaseTarget | null>(null)

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [p, w] = await Promise.all([
        apiClient.get<PortfolioResponse>("/investor/portfolio"),
        apiClient.get<{ ideas: Saved[] }>("/investor/watchlist"),
      ])
      setPortfolio(p.data)
      setSaved(w.data.ideas)
    } catch (err) {
      setPortfolio({ data: [], totalCommitted: 0, totalReleased: 0 })
      setSaved([])
      setError(apiError(err, "Couldn't load your investments."))
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const rows = portfolio?.data ?? []
  const committedIds = new Set(rows.map((r) => String(r.ideaId)))
  const stillSaved = (saved ?? []).filter((s) => !committedIds.has(String(s._id)))
  const open = rows.filter((r) => r.released < r.committed)
  const done = rows.filter((r) => r.committed > 0 && r.released >= r.committed)
  // Milestones the founder marked done that this investor hasn't released anything against yet.
  const waiting = open.flatMap((r) => r.milestones
    .filter((m) => m.status === "done" && !r.releases.some((x) => String(x.milestoneId) === String(m.id)))
    .map((m) => ({ row: r, milestone: m })))
  const target = (r: Row, milestone?: { id: string; title: string }): ReleaseTarget =>
    ({ investmentId: r.id, ideaName: r.name, committed: r.committed, released: r.released, milestone })
  const totalCommitted = portfolio?.totalCommitted ?? 0
  const totalReleased = portfolio?.totalReleased ?? 0

  return (
    <Page>
      <PageTitle title="Investments">
        {rows.length > 0
          ? `${usd(totalCommitted)} committed to ${countOf(rows.length, "idea")}, ${usd(totalReleased)} released, ${usd(totalCommitted - totalReleased)} still committed. No money moves on Something yet.`
          : "Ideas you save and commit to show up here."}
      </PageTitle>

      {/* The pipeline in order: saved → committed → released. Laptops: what's coming on the right. */}
      <Split className="mt-12">
        <Main>
          {error && (
            <div role="alert" className="mb-10 flex items-baseline gap-5">
              <p className="text-[15px] text-destructive">{error}</p>
              <button type="button" onClick={fetchAll} className={quietLinkClass}>Retry</button>
            </div>
          )}

          <Section title="Saved" className="mt-0" action={stillSaved.length ? <span>{stillSaved.length}</span> : undefined}>
            {saved === null ? (
              <SkeletonRows />
            ) : stillSaved.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">
                Nothing saved. Use Save in <Link href="/investor/search" className="text-foreground underline underline-offset-4">Discover</Link> to keep ideas you want to look at again.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {stillSaved.map((s) => (
                  <li key={s._id} className="flex items-baseline justify-between gap-6 py-5">
                    <div className="min-w-0">
                      <Link href={`/investor/search/${s._id}`} className="text-lg text-foreground hover:underline underline-offset-4">{s.title}</Link>
                      <p className="mt-1 flex flex-wrap gap-x-5 text-xs text-muted-foreground">
                        {s.author && <span>{s.author}</span>}
                        <span>{s.stage ? labelFor("ideaStages", s.stage) : "No stage yet"}</span>
                        {s.tags && s.tags.length > 0 && <span>{s.tags.map((t) => labelFor("sectors", t)).join(", ")}</span>}
                      </p>
                    </div>
                    <Link href={`/investor/search/${s._id}`} className={quietLinkClass}>Open</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Committed" action={open.length ? <span>{open.length}</span> : undefined}>
            {portfolio === null ? (
              <SkeletonRows />
            ) : open.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">No open commitments.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {open.map((r) => <InvestmentRow key={r.id} row={r} onRelease={() => setReleasing(target(r))} />)}
              </ul>
            )}
          </Section>

          <Section title="Released" action={done.length ? <span>{done.length}</span> : undefined}>
            {portfolio === null ? (
              <SkeletonRows />
            ) : done.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Commitments you have fully released show up here.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {done.map((r) => <InvestmentRow key={r.id} row={r} />)}
              </ul>
            )}
          </Section>
        </Main>

        <Aside>
          {rows.length > 0 && (
            <MoneyPanel
              className="mb-14"
              rows={[
                { label: "Committed", value: usd(totalCommitted), tone: "gold" },
                { label: "Released", value: usd(totalReleased), tone: totalReleased > 0 ? "done" : "plain" },
                { label: "Still committed", value: usd(totalCommitted - totalReleased) },
                { label: rows.length === 1 ? "Idea" : "Ideas", value: String(rows.length) },
              ]}
              note="No money moves on Something yet: commitments and releases are records."
            />
          )}
          <Section title="Milestone releases">
            {portfolio === null ? (
              <SkeletonRows />
            ) : waiting.length === 0 ? (
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Nothing waiting. When a founder marks a milestone done, you can record a release for it here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {waiting.map(({ row, milestone }) => (
                  <li key={`${row.id}-${milestone.id}`} className="py-4">
                    <p className="text-[15px] leading-relaxed">
                      <Link href={`/investor/search/${row.ideaId}`} className="hover:underline underline-offset-4">{row.name}</Link>{" "}
                      <span className="text-muted-foreground">finished “{milestone.title}”.</span>
                    </p>
                    <button type="button" onClick={() => setReleasing(target(row, milestone))} className="mt-2 text-sm text-foreground underline-offset-4 hover:underline cursor-pointer">
                      Record a release
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

        </Aside>
      </Split>

      <ReleaseDialog target={releasing} onClose={() => setReleasing(null)} onDone={() => { setReleasing(null); fetchAll() }} />
    </Page>
  )
}

/** Phones: name and amount, then a meta line. Laptops (xl): the idea | committed | released and date. */
function InvestmentRow({ row: p, onRelease }: { row: Row; onRelease?: () => void }) {
  return (
    <li className="py-6 xl:grid xl:grid-cols-[minmax(0,1fr)_112px_136px] xl:items-baseline xl:gap-x-8">
      <div className="flex min-w-0 gap-4">
        <Link href={`/investor/search/${p.ideaId}`} tabIndex={-1} aria-hidden="true">
          <IdeaCover id={String(p.ideaId)} sectors={p.tags} className="size-14 shrink-0" rounded="rounded-xl" />
        </Link>
        <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-6">
          <Link href={`/investor/search/${p.ideaId}`} className="min-w-0 text-lg text-foreground hover:underline underline-offset-4">
            {p.name}
          </Link>
          <span className="shrink-0 text-base text-gold tabular-nums xl:hidden">{usd(p.committed)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-muted-foreground">
          {p.founder ? <FounderCardButton founder={p.founder} /> : p.author && <span>{p.author}</span>}
          <span>{p.stage ? labelFor("ideaStages", p.stage) : "No stage yet"}</span>
          {p.tags?.length > 0 && <span>{p.tags.map((t) => labelFor("sectors", t)).join(", ")}</span>}
          {p.committed_at && <span className="xl:hidden">Committed {dateLabel(p.committed_at)}</span>}
          <span className="xl:hidden">{usd(p.released)} released</span>
          <MilestoneMeter milestones={p.milestones} />
          {onRelease && (
            <button type="button" onClick={onRelease} className="text-xs text-foreground underline-offset-4 hover:underline cursor-pointer">
              Record a release
            </button>
          )}
        </div>
        </div>
      </div>
      <div className="hidden text-right xl:block">
        <p className="text-base text-gold tabular-nums">{usd(p.committed)}</p>
        <p className="text-xs text-muted-foreground">committed</p>
      </div>
      <div className="hidden text-right text-sm text-muted-foreground xl:block">
        <p className={p.released > 0 ? "tabular-nums text-done" : "tabular-nums"}>{usd(p.released)} released</p>
        {p.committed_at && <p className="text-xs">{dateLabel(p.committed_at)}</p>}
      </div>
    </li>
  )
}
