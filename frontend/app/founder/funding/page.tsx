"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { Aside, Main, Page, PageTitle, Section, Split, countOf, quietLinkClass, usd } from "@/components/shell/page"
import { MoneyPanel } from "@/components/visual/money-panel"
import { MilestoneTrack, type TrackMilestone } from "@/components/visual/milestone-track"
import { IdeaCover } from "@/components/visual/idea-cover"
import { Avatar } from "@/components/visual/avatar"
import { SkeletonRows } from "@/components/visual/skeleton"
import { dateLabel } from "@/lib/format"
import { labelFor } from "@/lib/taxonomy"
import { apiError } from "@/lib/utils"

type Investor = {
  name: string
  firm: string
  avatarUrl: string
  verified: boolean
  committed: number
  released: number
  committedAt: string | null
}

type FundingIdea = {
  id: string
  title: string
  tags: string[]
  stage: string
  isDraft: boolean
  milestones: TrackMilestone[]
  committed: number
  released: number
  investors: Investor[]
  releasedByMilestone: Record<string, number>
}

type Funding = { totals: { committed: number; released: number; investors: number }; ideas: FundingIdea[] }

/**
 * Funding, idea by idea, from real records: who committed, what they released, and the
 * milestones they release against. Nothing here moves money; it is what investors have
 * promised and recorded. (This page used to show a sample "escrow pipeline" with invented
 * amounts and reviewers.)
 */
export default function FounderFundingPage() {
  const [data, setData] = useState<Funding | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setData((await apiClient.get<Funding>("/founder/funding")).data)
    } catch (err) {
      setData({ totals: { committed: 0, released: 0, investors: 0 }, ideas: [] })
      setError(apiError(err, "Couldn't load your funding."))
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Ideas with money first, then ideas with milestones, then the rest.
  const ideas = (data?.ideas ?? []).slice().sort((a, b) =>
    (b.committed - a.committed) || (b.milestones.length - a.milestones.length))
  const withActivity = ideas.filter((i) => i.committed > 0 || i.milestones.length > 0)
  const quiet = ideas.filter((i) => i.committed === 0 && i.milestones.length === 0)

  return (
    <Page>
      <PageTitle title="Funding">
        What investors have committed to your ideas, and what they release as you finish milestones.
      </PageTitle>

      <Split className="mt-12">
        <Main>
          {error && (
            <div role="alert" className="mb-10 flex items-baseline gap-5">
              <p className="text-[15px] text-destructive">{error}</p>
              <button type="button" onClick={load} className={quietLinkClass}>Retry</button>
            </div>
          )}

          {data === null ? (
            <SkeletonRows rows={4} />
          ) : ideas.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              You haven&apos;t posted an idea yet.{" "}
              <Link href="/founder/ideas?new=true" className="text-foreground underline underline-offset-4">Post one</Link> and
              investors can commit to it.
            </p>
          ) : (
            <div className="space-y-10">
              {withActivity.map((idea) => <IdeaFunding key={idea.id} idea={idea} />)}
              {quiet.length > 0 && (
                <Section title={withActivity.length ? "Your other ideas" : "Your ideas"} className={withActivity.length ? undefined : "mt-0"}>
                  <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
                    No commitments or milestones yet. Add milestones on an idea so investors know what they&apos;d be releasing against.
                  </p>
                  <ul className="divide-y divide-border border-y border-border">
                    {quiet.map((idea) => (
                      <li key={idea.id}>
                        <Link href={`/founder/ideas/${idea.id}`} className="group flex items-center gap-4 py-4">
                          <IdeaCover id={idea.id} sectors={idea.tags} className="size-11 shrink-0" rounded="rounded-lg" />
                          <span className="min-w-0 flex-1 truncate text-base group-hover:underline underline-offset-4">{idea.title}</span>
                          <span className="shrink-0 text-sm text-muted-foreground">Add milestones</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}
        </Main>

        <Aside>
          {data && (
            <MoneyPanel
              className="mt-12 xl:mt-0"
              rows={[
                { label: "Committed to you", value: usd(data.totals.committed), tone: "gold" },
                { label: "Released", value: usd(data.totals.released), tone: data.totals.released > 0 ? "done" : "plain" },
                { label: "Still committed", value: usd(data.totals.committed - data.totals.released) },
                { label: data.totals.investors === 1 ? "Commitment" : "Commitments", value: String(data.totals.investors) },
              ]}
              note="No money moves on Something yet: these are what investors promised and recorded."
            />
          )}

          <Section title="How releases work">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              An investor commits to an idea. When you mark one of its milestones done, they&apos;re told and can record a
              release against it. You see each release here and in your notifications.
            </p>
          </Section>

          <Section title="Community funding">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Coming soon: raising small amounts from the community, alongside investors.
            </p>
          </Section>
        </Aside>
      </Split>
    </Page>
  )
}

/** One idea: its money, its milestones (with what was released against each) and its investors. */
function IdeaFunding({ idea }: { idea: FundingIdea }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <IdeaCover id={idea.id} sectors={idea.tags} className="size-14 shrink-0" rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <Link href={`/founder/ideas/${idea.id}`} className="text-xl leading-snug text-foreground underline-offset-4 hover:underline">
            {idea.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {idea.isDraft ? "Draft" : idea.stage ? labelFor("ideaStages", idea.stage) : "No stage yet"}
          </p>
        </div>
        <dl className="flex gap-8">
          <div>
            <dt className="text-xs text-muted-foreground">Committed</dt>
            <dd className="mt-1 text-xl font-light tabular-nums text-gold">{usd(idea.committed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Released</dt>
            <dd className={idea.released > 0 ? "mt-1 text-xl font-light tabular-nums text-done" : "mt-1 text-xl font-light tabular-nums"}>{usd(idea.released)}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-base text-foreground">Milestones</h3>
          {idea.milestones.length ? (
            <MilestoneTrack milestones={idea.milestones} released={idea.releasedByMilestone} />
          ) : (
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              No milestones yet.{" "}
              <Link href={`/founder/ideas/${idea.id}`} className="text-foreground underline underline-offset-4">Add them on the idea</Link>{" "}
              so investors can release against them.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-4 text-base text-foreground">
            {idea.investors.length ? countOf(idea.investors.length, "investor") : "Investors"}
          </h3>
          {idea.investors.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-muted-foreground">No commitments yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {idea.investors.map((inv, i) => (
                <li key={`${inv.name}-${i}`} className="flex items-center gap-3 py-3.5">
                  <Avatar name={inv.name} src={inv.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">
                      {inv.name}
                      {inv.verified && <span className="ml-2 text-xs text-done">Verified</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[inv.firm, inv.committedAt ? `committed ${dateLabel(inv.committedAt)}` : ""].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] tabular-nums text-gold">{usd(inv.committed)}</p>
                    <p className={inv.released > 0 ? "text-sm tabular-nums text-done" : "text-sm tabular-nums text-muted-foreground"}>
                      {usd(inv.released)} released
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
