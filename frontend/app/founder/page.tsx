"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { cached, cachedGet } from "@/lib/api-cache"
import { useAuth } from "@/components/auth-provider"
import { useNotifications } from "@/components/community/inbox-provider"
import { Aside, Main, Page, PageTitle, Section, Split, countOf, greeting, pillClass, quietLinkClass, relativeTime, usd } from "@/components/shell/page"
import { GettingStarted, type Step } from "@/components/shell/getting-started"
import { labelFor } from "@/lib/taxonomy"
import { apiError, cn } from "@/lib/utils"
import { saveIdeaDraft } from "@/lib/idea-draft"
import { IdeaPrivacyNote } from "@/components/idea-privacy-note"
import { TRIED_SOMETHING_KEY } from "@/lib/first-run"
import { IdeaCover } from "@/components/visual/idea-cover"
import { MilestoneMeter } from "@/components/visual/idea-card"
import { MoneyPanel } from "@/components/visual/money-panel"
import { LeaderboardCard } from "@/components/community/leaderboard-card"
import { SkeletonRows } from "@/components/visual/skeleton"
import { MatchedIdeas } from "@/components/matching/matched-ideas"

type Idea = {
  _id: string
  title: string
  stage?: string
  tags?: string[]
  isDraft?: boolean
  likes?: number
  comments?: number
  createdAt?: string
  milestones?: { status: "open" | "done" }[]
}
type Overview = {
  kpis: { ideas: number; teamMembers: number }
  totals: { committed: number; released: number; investors: number }
  committedByIdea: Record<string, number>
  team: { id: string; name: string; role: string; isYou: boolean }[]
  activity: { id: string; kind: string; text: string; at: string; ideaId: string }[]
}
type Profile = { profileCompletion?: number; interests?: string[] }

// What each kind of activity looks like: money in gold, finished things in green.
const ACTIVITY_DOT: Record<string, string> = {
  commit: "bg-gold",
  release: "bg-done",
  comment: "bg-foreground",
  team: "bg-[#6ea8fe]",
  like: "bg-muted-foreground",
}

/**
 * Founder home: say what you're working on, what needs you, your ideas, your team and what has
 * happened lately. Everything comes from the server; there are no sample numbers.
 */
export default function FounderHome() {
  const { user } = useAuth()
  // Ideas and the profile paint from what this tab already has (lib/api-cache), then refresh.
  const [ideas, setIdeas] = useState<Idea[] | null>(() => cached<Idea[]>("/ideas/user") ?? null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [overviewFailed, setOverviewFailed] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(() => cached<Profile>("/founder/profile") ?? null)
  const [triedSomething, setTriedSomething] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The shell's one notifications list (also behind the sidebar's Notifications menu).
  const notes = useNotifications()

  const loadOverview = useCallback(() => {
    setOverviewFailed(false)
    apiClient.get<Overview>("/founder/overview").then((r) => setOverview(r.data)).catch(() => setOverviewFailed(true))
  }, [])

  useEffect(() => {
    // A failed first load says so; a failed refresh keeps the list on screen.
    const loadIdeas = (first: boolean) =>
      cachedGet<Idea[]>("/ideas/user", setIdeas).catch((err) => {
        if (!first) return
        setIdeas([])
        setError(apiError(err, "Couldn't load your ideas."))
      })
    const loadProfile = () => cachedGet<Profile>("/founder/profile", setProfile).catch(() => setProfile(null))
    loadIdeas(true)
    loadProfile()
    loadOverview()
    // Answers from the Something box land on the profile and ideas; refresh what depends on them.
    const refresh = () => {
      loadProfile()
      loadIdeas(false)
    }
    window.addEventListener("profile:updated", refresh)
    try { setTriedSomething(localStorage.getItem(TRIED_SOMETHING_KEY) === "1") } catch { /* private mode */ }
    return () => window.removeEventListener("profile:updated", refresh)
  }, [loadOverview])

  const needsYou = notes.items ? notes.items.filter((n) => !n.read) : notes.error ? [] : null
  const teammates = overview?.team.filter((m) => !m.isYou) ?? []
  // Without this the team and activity would show skeletons forever.
  const overviewMissing = (what: string) => overviewFailed && !overview ? (
    <div role="alert" className="flex items-baseline gap-5">
      <p className="text-[15px] text-muted-foreground">Couldn&apos;t load {what}.</p>
      <button type="button" onClick={loadOverview} className={quietLinkClass}>Retry</button>
    </div>
  ) : null

  // One plain sentence instead of number tiles.
  const summary = overview && ideas
    ? [
        ideas.length ? `${countOf(ideas.length, "idea")}${teammates.length ? `, ${countOf(teammates.length, "teammate")}` : ""}.` : "No ideas yet.",
        overview.totals.committed > 0
          ? `${countOf(overview.totals.investors, "investor")} committed ${usd(overview.totals.committed)}, ${usd(overview.totals.released)} released. No money moves on Something yet.`
          : null,
      ].filter(Boolean).join(" ")
    : null

  const steps: Step[] = profile && ideas ? [
    { label: "Post your first idea", href: "/founder/ideas?new=true", done: ideas.length > 0 },
    { label: `Finish your profile (${profile.profileCompletion ?? 0}% done)`, href: "/founder/profile", done: (profile.profileCompletion ?? 0) >= 100 },
    { label: "Add the sectors you care about", href: "/founder/profile", done: (profile.interests ?? []).length > 0 },
    { label: "Talk an idea through with Something", href: "/founder/something", done: triedSomething },
  ] : []

  return (
    <Page>
      <PageTitle title={greeting(user?.name)}>{summary}</PageTitle>

      {/* Phones: box → Needs you → ideas. Laptops: box and ideas on the left, Needs you on the right. */}
      <Split className="mt-12">
        <Main>
          <DraftBox />
        </Main>

        <Aside>
          {overview && ideas && ideas.length > 0 && (
            <MoneyPanel
              className="mb-14 hidden xl:block"
              rows={[
                { label: "Committed to you", value: usd(overview.totals.committed), tone: "gold" },
                { label: "Released", value: usd(overview.totals.released), tone: overview.totals.released > 0 ? "done" : "plain" },
                { label: overview.totals.investors === 1 ? "Investor" : "Investors", value: String(overview.totals.investors) },
                { label: ideas.length === 1 ? "Idea" : "Ideas", value: String(ideas.length) },
              ]}
              note="No money moves on Something yet."
            />
          )}
          <Section title="Needs you">
            {needsYou === null ? (
              <SkeletonRows />
            ) : needsYou.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Nothing right now. Comments, requests and commitments show up here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {needsYou.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex items-baseline justify-between gap-6 py-4">
                    <span className="text-[15px] leading-relaxed">{n.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(n.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Team">
            {overviewMissing("your team") ?? (overview === null ? (
              <SkeletonRows />
            ) : teammates.length === 0 ? (
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Just you so far. When someone asks to join an idea, invite them from that chat. <Link href="/founder/teams" className="text-foreground underline underline-offset-4">Teams</Link>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {overview.team.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-6 py-3">
                    <span className="text-[15px]">{m.isYou ? "You" : m.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{m.role}</span>
                  </li>
                ))}
              </ul>
            ))}
          </Section>

          <LeaderboardCard kind="ideas" role="founder" title="Top ideas" />
        </Aside>

        <Main>
          <GettingStarted steps={steps} />

          <Section title="Your ideas" action={ideas && ideas.length > 0 ? <Link href="/founder/ideas" className="hover:text-foreground">All ideas</Link> : undefined}>
            {error ? (
              <p className="text-[15px] text-destructive">{error}</p>
            ) : ideas === null ? (
              <SkeletonRows />
            ) : ideas.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Your ideas will be listed here once you post one.</p>
            ) : (
              <ul className="divide-y divide-border">
                {ideas.slice(0, 5).map((idea) => (
                  <li key={idea._id}>
                    <Link href={`/founder/ideas/${idea._id}`} className="group flex items-center gap-4 py-4">
                      <IdeaCover id={idea._id} sectors={idea.tags} className="size-14 shrink-0" rounded="rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-6">
                          <span className="truncate text-base text-foreground group-hover:underline underline-offset-4">{idea.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(idea.createdAt)}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {idea.isDraft && <span className="rounded-full border border-line px-2 py-0.5 text-foreground">Draft</span>}
                          <span>{idea.stage ? labelFor("ideaStages", idea.stage) : "No stage yet"}</span>
                          {(overview?.committedByIdea[idea._id] ?? 0) > 0 && (
                            <span className="text-gold">{usd(overview!.committedByIdea[idea._id])} committed</span>
                          )}
                          <MilestoneMeter milestones={idea.milestones} />
                          <span>{countOf(idea.likes ?? 0, "supporter")}</span>
                          <span>{countOf(idea.comments ?? 0, "comment")}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <MatchedIdeas role="founder" />

          <Section title="Recent activity">
            {overviewMissing("recent activity") ?? (overview === null ? (
              <SkeletonRows />
            ) : overview.activity.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Nothing yet. Supporters, comments and commitments on your ideas show up here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {overview.activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-6 py-4">
                    <Link href={`/founder/ideas/${a.ideaId}`} className="flex items-baseline gap-3 text-[15px] leading-relaxed hover:underline underline-offset-4">
                      <span className={cn("size-2 shrink-0 translate-y-[-1px] rounded-full", ACTIVITY_DOT[a.kind] ?? "bg-line")} aria-hidden="true" />
                      {a.text}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </Section>
        </Main>
      </Split>
    </Page>
  )
}

/** "What are you working on?": its own component, so typing doesn't re-render the whole home page. */
function DraftBox() {
  const router = useRouter()
  const [draft, setDraft] = useState("")

  const continueToPost = () => {
    saveIdeaDraft(draft.trim())
    router.push("/founder/ideas?new=true")
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); continueToPost() }}>
      <label htmlFor="idea-draft" className="block text-lg text-foreground">What are you working on?</label>
      <textarea
        id="idea-draft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="A sentence or two is enough. You can add details later."
        className="mt-4 w-full resize-none rounded-xl border border-input bg-transparent px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none xl:min-h-32"
      />
      <IdeaPrivacyNote className="mt-2" />
      <div className="mt-4 flex items-center gap-5">
        <button type="submit" className={pillClass}>
          {draft.trim() ? "Continue" : "Post an idea"}
        </button>
        <Link href="/founder/something" className={quietLinkClass}>Talk it through with Something first</Link>
      </div>
    </form>
  )
}
