"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/axios"
import { useAuth } from "@/components/auth-provider"
import { Aside, Main, Page, PageTitle, Section, Split, countOf, greeting, pillClass, relativeTime, usd } from "@/components/shell/page"
import { GettingStarted, type Step } from "@/components/shell/getting-started"
import { IdeaCard } from "@/components/visual/idea-card"
import { IdeaCover } from "@/components/visual/idea-cover"
import { MoneyPanel } from "@/components/visual/money-panel"
import { labelFor, normalizeList } from "@/lib/taxonomy"
import { apiError } from "@/lib/utils"
import { SkeletonRows } from "@/components/visual/skeleton"

type Idea = {
  _id: string
  title: string
  description?: string
  author?: string
  stage?: string
  tags?: string[]
  createdAt?: string
  likes?: number
  raising?: string
  founderAvatar?: string
  founderLocation?: string
  milestones?: { status: "open" | "done" }[]
}
type Notification = { id: string; text: string; timestamp: string; read: boolean }
type Portfolio = { data: Array<{ ideaId: string }>; totalCommitted: number; totalReleased: number }
type Profile = { interests?: string[]; totalCapitalPool?: number; knownFields?: string[] }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Investor home: one thing to do (search), what needs you, this week's ideas in your sectors,
 * the most liked ones, and what you've committed. Server data only: the "free" part of the
 * capital pool shows only once the investor has entered a pool (there is no $1M default).
 */
export default function InvestorHome() {
  const { user } = useAuth()
  const router = useRouter()
  const [q, setQ] = useState("")
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [sectors, setSectors] = useState<string[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [notes, setNotes] = useState<Notification[] | null>(null)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient.get<Idea[]>("/ideas/discover").then((r) => setIdeas(r.data)).catch((err) => {
      setIdeas([])
      setError(apiError(err, "Couldn't load ideas."))
    })
    // Answers from the Something box land on the profile; refresh what depends on it.
    const loadProfile = () => apiClient
      .get<Profile>("/investor/profile")
      .then((r) => { setProfile(r.data); setSectors(normalizeList("sectors", r.data.interests ?? [])) })
      .catch(() => setSectors([]))
    loadProfile()
    window.addEventListener("profile:updated", loadProfile)
    apiClient.get<{ ids: string[] }>("/investor/watchlist").then((r) => setSavedCount(r.data.ids.length)).catch(() => setSavedCount(null))
    apiClient.get<Notification[]>("/notifications").then((r) => setNotes(r.data)).catch(() => setNotes([]))
    apiClient.get<Portfolio>("/investor/portfolio").then((r) => setPortfolio(r.data)).catch(() => setPortfolio(null))
    return () => window.removeEventListener("profile:updated", loadProfile)
  }, [])

  // Ideas in the investor's sectors (all ideas when no sectors are set yet).
  const inSectors = useMemo(() => {
    if (!ideas) return null
    return sectors.length
      ? ideas.filter((i) => normalizeList("sectors", i.tags ?? []).some((t) => sectors.includes(t)))
      : ideas
  }, [ideas, sectors])
  // This week's; if there are none, the newest ones so the list is never empty for no reason.
  const thisWeek = inSectors?.filter((i) => i.createdAt && Date.now() - new Date(i.createdAt).getTime() < WEEK_MS) ?? null
  const latest = thisWeek && inSectors ? (thisWeek.length ? thisWeek : inSectors).slice(0, 5) : null
  const popular = inSectors
    ? [...inSectors].filter((i) => (i.likes ?? 0) > 0).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 5)
    : null

  const sectorNames = sectors.map((s) => labelFor("sectors", s))
  const where = sectorNames.length
    ? `in ${sectorNames.length > 2 ? `${sectorNames.slice(0, 2).join(", ")} and more` : sectorNames.join(" and ")}`
    : ""
  const latestTitle = thisWeek && thisWeek.length
    ? `This week ${where}`.trim()
    : sectorNames.length ? `Newest ${where}` : "Newest ideas"

  const needsYou = notes?.filter((n) => !n.read) ?? null
  const poolKnown = Boolean(profile?.knownFields?.includes("totalCapitalPool"))
  const committed = portfolio?.totalCommitted ?? 0
  const summary = portfolio && profile ? (
    <>
      {portfolio.data.length > 0
        ? `${usd(committed)} committed to ${countOf(portfolio.data.length, "idea")}, ${usd(portfolio.totalReleased)} released. `
        : "No commitments yet. "}
      {poolKnown ? (
        `${usd(Math.max(0, (profile.totalCapitalPool ?? 0) - committed))} of your ${usd(profile.totalCapitalPool)} pool is not committed.`
      ) : (
        <><Link href="/investor/profile" className="text-foreground underline underline-offset-4">Set your capital pool</Link>.</>
      )}{" "}
      No money moves on Something yet.
    </>
  ) : null

  const steps: Step[] = profile && portfolio && savedCount !== null ? [
    { label: "Pick the sectors you invest in", href: "/investor/profile", done: sectors.length > 0 },
    { label: "Set your check size", href: "/investor/profile", done: Boolean(profile.knownFields?.some((f) => f === "minCheck" || f === "maxCheck")) },
    { label: "Set your capital pool", href: "/investor/profile", done: poolKnown },
    { label: "Save an idea you like", href: "/investor/search", done: savedCount > 0 },
    { label: "Make your first commitment", href: "/investor/search", done: portfolio.data.length > 0 },
  ] : []

  return (
    <Page>
      <PageTitle title={greeting(user?.name)}>{summary}</PageTitle>

      {/* Phones: search → Needs you → new ideas → commitments. Laptops: search and new ideas
          on the left; Needs you and commitments on the right. */}
      <Split className="mt-12">
        <Main>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              router.push(q.trim() ? `/investor/search?q=${encodeURIComponent(q.trim())}` : "/investor/search")
            }}
          >
            <label htmlFor="idea-search" className="block text-lg text-foreground">Find ideas</label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                id="idea-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="A sector, a problem, a founder's name"
                className="h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-full border border-input bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
              />
              <button type="submit" className={pillClass}>Search</button>
            </div>
          </form>
        </Main>

        <Aside>
          {portfolio && profile && (
            <MoneyPanel
              className="mb-14 hidden xl:block"
              rows={[
                { label: "You committed", value: usd(committed), tone: "gold" },
                { label: "Released", value: usd(portfolio.totalReleased), tone: portfolio.totalReleased > 0 ? "done" : "plain" },
                { label: portfolio.data.length === 1 ? "Idea" : "Ideas", value: String(portfolio.data.length) },
                poolKnown
                  ? { label: "Pool not committed", value: usd(Math.max(0, (profile.totalCapitalPool ?? 0) - committed)) }
                  : { label: "Capital pool", value: "Not set" },
              ]}
              note={poolKnown ? "No money moves on Something yet." : <>No money moves on Something yet. <Link href="/investor/profile" className="text-foreground underline underline-offset-4">Set your capital pool</Link>.</>}
            />
          )}
          <Section title="Needs you">
            {needsYou === null ? (
              <SkeletonRows />
            ) : needsYou.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Nothing right now. Replies and updates from founders show up here.</p>
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

          <Section title={sectorNames.length ? "Popular in your sectors" : "Popular"}>
            {popular === null ? (
              <SkeletonRows />
            ) : popular.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">No likes yet. The most liked ideas show up here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {popular.map((idea) => (
                  <li key={idea._id}>
                    <Link href={`/investor/search/${idea._id}`} className="group flex items-center gap-3 py-3">
                      <IdeaCover id={idea._id} sectors={normalizeList("sectors", idea.tags ?? [])} className="size-10 shrink-0" rounded="rounded-lg" />
                      <span className="min-w-0 flex-1 truncate text-[15px] group-hover:underline underline-offset-4">{idea.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{countOf(idea.likes ?? 0, "like")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Aside>

        <Main>
          <GettingStarted steps={steps} />

          <Section title={latestTitle} action={<Link href="/investor/search" className="hover:text-foreground">See all</Link>}>
            {error ? (
              <p className="text-[15px] text-destructive">{error}</p>
            ) : latest === null ? (
              <SkeletonRows />
            ) : latest.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">
                {sectors.length ? "No new ideas in your sectors yet." : "No ideas have been posted yet."}
              </p>
            ) : (
              <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
                {latest.slice(0, 4).map((idea) => (
                  <li key={idea._id}>
                    <IdeaCard
                      href={`/investor/search/${idea._id}`}
                      idea={{
                        id: idea._id,
                        title: idea.title,
                        description: idea.description,
                        sectors: normalizeList("sectors", idea.tags ?? []),
                        stage: idea.stage,
                        raising: idea.raising,
                        author: idea.author,
                        authorAvatar: idea.founderAvatar,
                        location: idea.founderLocation,
                        createdAt: idea.createdAt,
                        milestones: idea.milestones,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Main>
      </Split>
    </Page>
  )
}
