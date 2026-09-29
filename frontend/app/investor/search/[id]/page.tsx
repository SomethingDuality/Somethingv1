"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import apiClient, { assetUrl } from "@/lib/axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { apiError, cn } from "@/lib/utils"
import { Aside, Main, Page, PageTitle, Section, Split, pillClass, quietLinkClass, usd } from "@/components/shell/page"
import { FounderCard, type FounderCardData } from "@/components/founder-card"
import { fileKind } from "@/lib/files"
import { IdeaCover } from "@/components/visual/idea-cover"
import { IdeaFacts } from "@/components/visual/idea-facts"
import { MoneyPanel } from "@/components/visual/money-panel"
import { IdeaUpdates } from "@/components/idea-updates"
import { IdeaMilestones, toMilestone, type Milestone } from "@/components/idea-milestones"
import { ReleaseDialog, type ReleaseTarget } from "@/components/release-dialog"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/components/auth-provider"
import { normalizeList } from "@/lib/taxonomy"
import { SkeletonRows } from "@/components/visual/skeleton"

/** What the brief shows, all from GET /ideas/:id. */
type Project = {
  id: string
  name: string
  domains: string[]
  desc: string
  stage: string
  launchedAt: string | null
  views: number
  likes: number
  comments: number
  founder: FounderCardData | null
  team: { name: string; role: string; isFounder: boolean }[]
  commitments: { count: number; total: number; released: number }
  files: { name: string; url?: string; size?: string; type?: string }[]
  raising: string
  milestones: Milestone[]
}

/** This investor's commitment to the idea, as GET /investor/portfolio returns it. */
type Mine = { id: string; committed: number; released: number; releases: { amount: number; milestoneId: string | null }[] }

export default function ProjectBriefPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [p, setP] = useState<Project | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(true)

  // NDA state
  const [ndaSigned, setNdaSigned] = useState(false)
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false)
  const [legalName, setLegalName] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  useEffect(() => {
    if (!id) return
    const isSigned = localStorage.getItem(`nda_signed_${id}`) === "true"
    setNdaSigned(isSigned)
  }, [id])

  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setIsLoadingProject(true)
    setLoadError(null)

    const fetchProject = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let projectData: any
      try {
        projectData = (await apiClient.get(`/ideas/${id}`)).data
      } catch (err) {
        // No fallback to the sample projects: a missing or unreachable idea says so.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status !== 404) setLoadError(apiError(err, "Couldn't load this brief."))
        setP(null)
        setIsLoadingProject(false)
        return
      }

      setP({
        id: projectData._id ?? projectData.id,
        name: projectData.title ?? "Untitled",
        domains: normalizeList("sectors", projectData.tags ?? []),
        desc: projectData.description ?? projectData.desc ?? "",
        stage: projectData.stage ?? "", // unset stays unset (it used to show "Concept")
        launchedAt: projectData.createdAt ?? null,
        views: projectData.views ?? 0,
        likes: projectData.likes ?? 0,
        comments: projectData.comments ?? 0,
        founder: projectData.founder ?? (projectData.author ? { name: projectData.author } : null),
        team: projectData.team ?? [],
        commitments: projectData.commitments ?? { count: 0, total: 0, released: 0 },
        raising: projectData.raising ?? "",
        milestones: (projectData.milestones ?? []).map(toMilestone),
        files: (projectData.attachments ?? []).map((a: { name: string; url?: string; size?: string; type?: string }) => ({ name: a.name, url: a.url, size: a.size, type: a.type })),
      })
      setIsLoadingProject(false)
    }

    fetchProject()
  }, [id])

  // This investor's own commitment to the idea (for "Committed $X" and milestone releases).
  const loadMine = useCallback(() => {
    apiClient
      .get<{ data: Array<Mine & { ideaId: string }> }>("/investor/portfolio")
      .then((res) => {
        const row = res.data.data.find((r) => String(r.ideaId) === id) ?? null
        setMine(row)
        setMyCommit(row?.committed ?? null)
      })
      .catch(() => { setMine(null); setMyCommit(null) })
  }, [id])

  const askForUpdate = async () => {
    try {
      const res = await apiClient.post<{ sent: boolean }>(`/ideas/${id}/request-update`, {})
      toast(res.data.sent
        ? { title: "Asked", description: "The founder sees your request in “Needs you”." }
        : { title: "Already asked this week", description: "You can ask again next week." })
    } catch (err) {
      toast({ title: "Not sent", description: apiError(err, "Please try again."), variant: "destructive" })
    }
  }

  // ---- Commit funds: a real amount, a summary and an explicit "no money moves yet" acknowledgement.
  const { user } = useAuth()
  const [myCommit, setMyCommit] = useState<number | null>(null)
  const [mine, setMine] = useState<Mine | null>(null)
  const [releasing, setReleasing] = useState<ReleaseTarget | null>(null)
  const [knownMinCheck, setKnownMinCheck] = useState<number | null>(null)
  const [commitOpen, setCommitOpen] = useState(false)
  const [commitAmount, setCommitAmount] = useState("")
  const [commitAck, setCommitAck] = useState(false)
  const [commitSaving, setCommitSaving] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    // Already committed? Show that instead of offering a second commit.
    loadMine()
    // Prefill the amount only from a minimum check the investor actually set (not the $5k default).
    apiClient
      .get<{ minCheck?: number; knownFields?: string[] }>("/investor/profile")
      .then((res) => setKnownMinCheck(res.data.knownFields?.includes("minCheck") && res.data.minCheck ? res.data.minCheck : null))
      .catch(() => setKnownMinCheck(null))
  }, [id, loadMine])

  // Every hook must run before the early returns below (React rules of hooks).

  if (isLoadingProject) {
    return <Page><SkeletonRows /></Page>
  }

  if (!p) {
    return (
      <Page>
        <PageTitle title={loadError ? "Couldn't load this idea" : "This idea isn't available"}>
          {loadError ?? "It may have been deleted, or it's still a draft."}
        </PageTitle>
        <Link href="/investor/search" className={cn(quietLinkClass, "mt-8 inline-block")}>Back to Discover</Link>
      </Page>
    )
  }

  const handleStartChat = (founderName: string) => {
    const isGhost = localStorage.getItem("investor_ghost_mode") === "true"

    const storedThreads = localStorage.getItem("investor_threads")
    let threads = []
    if (storedThreads) {
      try {
        threads = JSON.parse(storedThreads)
      } catch {
        threads = []
      }
    }
    
    const cleanId = "th-" + founderName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    
    // Add to investor_threads
    const exists = threads.some((t: any) => t.id === cleanId)
    if (!exists) {
      const newThread = {
        id: cleanId,
        name: `${founderName} • ${p.name}`,
        lastMessagePreview: isGhost ? `[stealth match] Message sent from Ghost Investor` : `New conversation regarding ${p.name}...`,
        unreadCount: 0,
        participants: [{ id: cleanId.replace("th-", ""), name: founderName, avatarInitials: founderName.split(" ").map((n) => n[0]).join(""), isOnline: true }],
        lastActive: new Date().toISOString(),
        isOnline: true,
        isGhostMode: isGhost,
      }
      const updated = [newThread, ...threads]
      localStorage.setItem("investor_threads", JSON.stringify(updated))
    }

    // Add to founder_chat_threads and messages
    const founderStored = localStorage.getItem("founder_chat_threads")
    let founderThreads = []
    if (founderStored) {
      try { founderThreads = JSON.parse(founderStored) } catch { founderThreads = [] }
    }
    
    const founderExists = founderThreads.some((t: any) => t.id === cleanId)
    if (!founderExists) {
      const investorName = localStorage.getItem("demo_name") || ""
      const newFounderThread = {
        id: cleanId,
        name: isGhost ? "Ghost Investor" : investorName,
        preview: `New conversation regarding ${p.name}...`,
        unread: 1,
        category: "requests",
        participants: [founderName, isGhost ? "Ghost Investor" : investorName],
        lastActive: "Just now",
        isOnline: true,
        isGhostMode: isGhost,
        realInvestorName: investorName,
        realFirmName: localStorage.getItem("demo_firm") || ""
      }
      const updatedFounder = [newFounderThread, ...founderThreads]
      localStorage.setItem("founder_chat_threads", JSON.stringify(updatedFounder))
      
      // Initialize messages
      const founderMsgs = localStorage.getItem("founder_chat_messages")
      let msgsDb: Record<string, any> = {}
      if (founderMsgs) {
        try { msgsDb = JSON.parse(founderMsgs) } catch { msgsDb = {} }
      }
      msgsDb[cleanId] = [
        {
          id: `m-init-${Date.now()}`,
          from: "them",
          text: `Hi ${founderName}, I'm interested in your project brief for ${p.name}.`,
          when: "Just now",
          timestamp: Date.now(),
          seen: false,
          delivered: true
        }
      ]
      localStorage.setItem("founder_chat_messages", JSON.stringify(msgsDb))
      
      // Sync investor messages
      localStorage.setItem(`investor_msgs_${cleanId}`, JSON.stringify([
        {
          id: `m-init-${Date.now()}`,
          sender: { id: cleanId.replace("th-", ""), name: founderName },
          text: `Hi ${founderName}, I'm interested in your project brief for ${p.name}.`,
          createdAt: new Date().toISOString(),
          deliveryStatus: "delivered"
        }
      ]))
    }
    
    router.push(`/investor/chats?activeId=${cleanId}`)
  }

  const openCommit = () => {
    setCommitAmount(knownMinCheck ? String(knownMinCheck) : "")
    setCommitAck(false)
    setCommitError(null)
    setCommitOpen(true)
  }

  const amountNumber = Number(commitAmount.replace(/[^0-9.]/g, ""))
  const amountValid = Number.isFinite(amountNumber) && amountNumber >= 1 && amountNumber <= 1e9

  const confirmCommit = async () => {
    if (!amountValid || !commitAck || commitSaving) return
    setCommitSaving(true)
    setCommitError(null)
    try {
      await apiClient.post("/investor/commit", { ideaId: p.id, amount: amountNumber })
      setMyCommit(amountNumber)
      // The total under the actions now includes this commitment.
      setP((cur) => (cur ? { ...cur, commitments: { ...cur.commitments, count: cur.commitments.count + 1, total: cur.commitments.total + amountNumber } } : cur))
      loadMine()
      setCommitOpen(false)
      toast({ title: "Commitment recorded", description: `$${amountNumber.toLocaleString()} to ${p.name}. No money has moved.` })
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 409) {
        setCommitError("You've already committed to this idea. It's in your investments.")
      } else {
        setCommitError(apiError(err, "Your commitment wasn't recorded. Please try again."))
      }
    } finally {
      setCommitSaving(false)
    }
  }

  const handleAffixSignature = () => {
    if (!legalName.trim() || !agreedToTerms) return
    localStorage.setItem(`nda_signed_${p.id}`, "true")
    setNdaSigned(true)
    setIsSigningModalOpen(false)
  }

  const founder = p.founder

  return (
    <Page>
      <Link href="/investor/search" className={quietLinkClass}>Back to Discover</Link>

      {/* The idea's cover, then: the pitch on the left; money, founder and files on the right (xl). */}
      <IdeaCover id={p.id} sectors={p.domains} className="mt-6 aspect-[21/9] w-full sm:aspect-[32/9]" rounded="rounded-3xl" />

      <Split className="mt-10">
        <Main>
          <div>
            <PageTitle title={p.name} />
            <div className="mt-5">
              <IdeaFacts
                founder={founder?.name}
                founderAvatar={founder?.avatarUrl}
                stage={p.stage}
                raising={p.raising}
                location={founder?.location}
                sectors={p.domains}
                postedAt={p.launchedAt}
                views={p.views}
                likes={p.likes}
                comments={p.comments}
              />
            </div>
            <p className="mt-8 max-w-[62ch] whitespace-pre-line text-lg leading-relaxed text-foreground/90">{p.desc}</p>
          </div>

          <IdeaUpdates ideaId={p.id} isOwner={false} />

          <IdeaMilestones
            ideaId={p.id}
            milestones={p.milestones}
            isOwner={false}
            onChange={() => {}}
            released={Object.fromEntries((mine?.releases ?? []).filter((r) => r.milestoneId).map((r) => [String(r.milestoneId), r.amount]))}
            action={(m) =>
              mine && mine.released < mine.committed && !mine.releases.some((r) => String(r.milestoneId) === m.id) ? (
                <button
                  type="button"
                  onClick={() => setReleasing({ investmentId: mine.id, ideaName: p.name, committed: mine.committed, released: mine.released, milestone: { id: m.id, title: m.title } })}
                  className="text-sm text-foreground underline-offset-4 hover:underline cursor-pointer"
                >
                  Record a release
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Done</span>
              )
            }
          />
        </Main>

        <Aside>
          <MoneyPanel
            className="mt-12 xl:mt-0"
            rows={[
              { label: "Committed so far", value: usd(p.commitments.total), tone: "gold" },
              { label: p.commitments.count === 1 ? "Investor" : "Investors", value: String(p.commitments.count) },
              ...(mine ? [
                { label: "Your commitment", value: usd(mine.committed) },
                { label: "You released", value: usd(mine.released), tone: mine.released > 0 ? ("done" as const) : ("plain" as const) },
              ] : []),
            ]}
            note="No money moves on Something yet: commitments and releases are records."
          >
            {myCommit !== null ? (
              <Link href="/investor/investments" className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-gold/40 bg-gold-soft px-5 text-[15px] text-gold hover:border-gold/70">
                In your investments
              </Link>
            ) : (
              <button type="button" onClick={openCommit} className={pillClass}>Commit funds</button>
            )}
            <button type="button" onClick={askForUpdate} className={quietLinkClass}>Ask for an update</button>
            {founder && (
              <button type="button" onClick={() => handleStartChat(founder.name)} className={quietLinkClass}>
                Message {founder.name.split(" ")[0]}
              </button>
            )}
          </MoneyPanel>

          {founder && (
            <Section title="Founder">
              <FounderCard founder={founder} />
            </Section>
          )}

          {p.team.filter((m) => !m.isFounder).length > 0 && (
            <Section title="Team">
              <ul className="divide-y divide-border">
                {p.team.map((m, i) => (
                  <li key={`${m.name}-${i}`} className="flex items-baseline justify-between gap-6 py-3">
                    <span className="text-[15px]">{m.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{m.isFounder ? "Founder" : m.role}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Files">
            {p.files.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">The founder hasn&apos;t attached any files.</p>
            ) : !ndaSigned ? (
              <div className="space-y-4">
                <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
                  {p.files.length} {p.files.length === 1 ? "file" : "files"}. The founder asks you to agree to keep them confidential before opening them.
                </p>
                <button
                  type="button"
                  onClick={() => { if (!legalName) setLegalName(user?.name ?? ""); setIsSigningModalOpen(true) }}
                  className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-input px-5 text-[15px] text-foreground hover:border-muted-foreground cursor-pointer"
                >
                  Read and agree
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {p.files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-baseline justify-between gap-6 py-4">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">{f.name}</span>
                      <span className="block text-xs text-muted-foreground">{[fileKind(f.type), f.size].filter(Boolean).join(", ")}</span>
                    </span>
                    {f.url ? (
                      <a href={assetUrl(f.url)} target="_blank" rel="noopener noreferrer" className={quietLinkClass}>Open</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not uploaded</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

        </Aside>
      </Split>

      <ReleaseDialog target={releasing} onClose={() => setReleasing(null)} onDone={() => { setReleasing(null); loadMine() }} />

      {/* Commit dialog */}
      <Dialog open={commitOpen} onOpenChange={(o) => !commitSaving && setCommitOpen(o)}>
        <DialogContent className="w-full max-w-md rounded-2xl border-border bg-popover p-8 text-popover-foreground">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-medium">Commit to {p.name}</DialogTitle>
            <DialogDescription className="text-[15px] text-muted-foreground">
              This records your intent to invest. No money moves on Something yet.
            </DialogDescription>
          </DialogHeader>

          <form className="mt-2 space-y-5" onSubmit={(e) => { e.preventDefault(); confirmCommit() }}>
            <div className="space-y-2">
              <label htmlFor="commit-amount" className="block text-[15px] text-foreground">Amount in US dollars</label>
              <input
                id="commit-amount"
                inputMode="numeric"
                autoFocus
                placeholder="10000"
                value={commitAmount}
                onChange={(e) => setCommitAmount(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
              />
              {knownMinCheck && commitAmount === String(knownMinCheck) && (
                <p className="text-xs text-muted-foreground">Filled in from your minimum check.</p>
              )}
            </div>

            {amountValid && (
              <p className="text-[15px] leading-relaxed text-foreground/90">
                You&apos;re committing ${amountNumber.toLocaleString()} to {p.name}
                {founder ? <> by {founder.name}</> : null}. They&apos;ll be notified.
              </p>
            )}

            <label className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={commitAck}
                onChange={(e) => setCommitAck(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-white"
              />
              I understand no money moves yet. This is a commitment, not a payment.
            </label>

            {commitError && <p role="alert" className="text-[15px] text-destructive">{commitError}</p>}

            <div className="flex items-center justify-end gap-5 pt-2">
              <button type="button" disabled={commitSaving} onClick={() => setCommitOpen(false)} className={quietLinkClass}>Cancel</button>
              <button type="submit" disabled={!amountValid || !commitAck || commitSaving} className={pillClass}>
                {commitSaving ? "Recording…" : "Confirm"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confidentiality agreement (recorded in this browser for now; see chat/future.md C9) */}
      <Dialog open={isSigningModalOpen} onOpenChange={setIsSigningModalOpen}>
        <DialogContent className="w-full max-w-lg rounded-2xl border-border bg-popover p-8 text-popover-foreground">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-medium">Keep {p.name}&apos;s files confidential</DialogTitle>
            <DialogDescription className="text-[15px] text-muted-foreground">
              A short mutual non-disclosure agreement between you and {founder?.name ?? "the founder"}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 max-h-[220px] space-y-3 overflow-y-auto rounded-lg border border-border p-4 text-sm leading-relaxed text-muted-foreground">
            <p>You and the founder may share confidential information while you look at a possible investment.</p>
            <p>You agree to keep what you see here private: the files, figures and plans. You won&apos;t copy, share or sell them without the founder&apos;s consent.</p>
            <p>This doesn&apos;t cover anything that was already public or that you knew before.</p>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="nda-legal-name-input" className="block text-[15px] text-foreground">Your full legal name</label>
              <input
                id="nda-legal-name-input"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-base text-foreground focus:border-muted-foreground focus:outline-none"
              />
            </div>
            <label className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                id="agree-checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-white"
              />
              I agree to keep these files confidential.
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-5">
            <button type="button" onClick={() => setIsSigningModalOpen(false)} className={quietLinkClass}>Cancel</button>
            <button type="button" onClick={handleAffixSignature} disabled={!legalName.trim() || !agreedToTerms} className={pillClass} id="nda-submit-btn">
              Agree and open files
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
