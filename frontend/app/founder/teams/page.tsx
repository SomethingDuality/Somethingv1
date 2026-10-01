"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios"
import { Aside, Main, Page, PageTitle, Section, Split, pillClass, quietLinkClass, relativeTime } from "@/components/shell/page"
import { SkeletonRows } from "@/components/visual/skeleton"
import { Avatar } from "@/components/visual/avatar"
import { toast } from "@/components/ui/use-toast"
import { apiError } from "@/lib/utils"

type Invite = {
  id: string
  idea: { id: string; title: string }
  role: string
  status: "pending" | "accepted" | "declined" | "revoked" | "expired"
  direction: "incoming" | "outgoing"
  other: { name: string }
  createdAt: string
  expiresAt: string
}

type Team = {
  id: string
  idea: { id: string; title: string }
  isOwner: boolean
  members: { id: string; name: string; role: string; kind: "owner" | "member"; joinedAt: string | null; isYou: boolean }[]
}

const STATUS: Record<Invite["status"], string> = {
  pending: "Waiting", accepted: "Joined", declined: "Said no", revoked: "Withdrawn", expired: "Expired",
}

/**
 * Teams (community C6): invites for you, the teams you're on, and invites you sent. People join
 * only by accepting an invite, and invites go out from a chat with someone who asked to join.
 */
export default function FounderTeamsPage() {
  const [incoming, setIncoming] = useState<Invite[] | null>(null)
  const [outgoing, setOutgoing] = useState<Invite[] | null>(null)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [inc, out, mine] = await Promise.all([
        apiClient.get<Invite[]>("/teams/invites"),
        apiClient.get<Invite[]>("/teams/invites?box=outgoing"),
        apiClient.get<Team[]>("/teams/mine"),
      ])
      setIncoming(inc.data)
      setOutgoing(out.data)
      setTeams(mine.data)
    } catch (err) {
      setError(apiError(err, "Couldn't load your teams."))
      setIncoming((x) => x ?? [])
      setOutgoing((x) => x ?? [])
      setTeams((x) => x ?? [])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (path: string, done: string) => {
    try {
      await apiClient.post(path, {})
      toast({ title: done })
      load()
    } catch (err) {
      toast({ title: "That didn't work", description: apiError(err, "Please try again."), variant: "destructive" })
    }
  }

  const remove = async (team: Team, memberId: string, name: string) => {
    try {
      await apiClient.delete(`/teams/${team.id}/members/${memberId}`)
      toast({ title: `${name} is off the team` })
      load()
    } catch (err) {
      toast({ title: "Not removed", description: apiError(err, "Please try again."), variant: "destructive" })
    }
  }

  return (
    <Page>
      <PageTitle title="Teams">
        The people building your ideas with you. When a founder asks to join one of your ideas, you can invite them from that chat.
      </PageTitle>
      {error && <p role="alert" className="mt-8 text-[15px] text-destructive">{error}</p>}

      <Split className="mt-10">
        <Main>
          {incoming !== null && incoming.length > 0 && (
            <Section title="Invites for you" className="mt-0">
              <ul className="divide-y divide-border border-y border-border">
                {incoming.map((i) => (
                  <li key={i.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[15px] leading-relaxed">
                      {i.other.name} invited you to join <span className="text-foreground">&ldquo;{i.idea.title}&rdquo;</span> as {i.role}.
                      <span className="block text-[13px] text-muted-foreground">{relativeTime(i.createdAt)}</span>
                    </p>
                    <div className="flex shrink-0 items-center gap-5">
                      <button type="button" onClick={() => act(`/teams/invites/${i.id}/accept`, "You're on the team")} className={pillClass}>Join</button>
                      <button type="button" onClick={() => act(`/teams/invites/${i.id}/decline`, "Invite declined")} className={quietLinkClass}>No thanks</button>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Your teams" className={incoming?.length ? undefined : "mt-0"}>
            {teams === null ? (
              <SkeletonRows />
            ) : teams.length === 0 ? (
              <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
                No teams yet. When someone asks to join one of your ideas, open that chat in{" "}
                <Link href="/founder/chats" className="text-foreground underline underline-offset-4">Chats</Link> and choose &ldquo;Invite to team&rdquo;.
              </p>
            ) : (
              <ul className="space-y-10">
                {teams.map((t) => <TeamBlock key={t.id} team={t} onRemove={remove} onLeave={() => act(`/teams/${t.id}/leave`, "You left the team")} />)}
              </ul>
            )}
          </Section>
        </Main>

        <Aside>
          <Section title="Invites you sent">
            {outgoing === null ? (
              <SkeletonRows />
            ) : outgoing.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">None yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {outgoing.map((i) => (
                  <li key={i.id} className="py-3">
                    <p className="text-[15px]">{i.other.name}, {i.role}</p>
                    <p className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground">
                      <span className="truncate">&ldquo;{i.idea.title}&rdquo; · {STATUS[i.status]}</span>
                      {i.status === "pending" && (
                        <button type="button" onClick={() => act(`/teams/invites/${i.id}/revoke`, "Invite withdrawn")} className="shrink-0 hover:text-foreground cursor-pointer">Withdraw</button>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Aside>
      </Split>
    </Page>
  )
}

function TeamBlock({ team, onRemove, onLeave }: {
  team: Team
  onRemove: (team: Team, memberId: string, name: string) => void
  onLeave: () => void
}) {
  const [confirm, setConfirm] = useState<string | null>(null)
  return (
    <li>
      <div className="flex items-baseline justify-between gap-4">
        <Link href={`/founder/ideas/${team.idea.id}`} className="text-lg underline-offset-4 hover:underline">{team.idea.title}</Link>
        {!team.isOwner && (
          confirm === "leave" ? (
            <span className="flex shrink-0 items-center gap-3 text-[13px]">
              Leave this team?
              <button type="button" onClick={onLeave} className="text-foreground underline underline-offset-4 cursor-pointer">Leave</button>
              <button type="button" onClick={() => setConfirm(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirm("leave")} className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Leave</button>
          )
        )}
      </div>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {team.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <Avatar name={m.name} size={28} />
              <span className="min-w-0">
                <span className="block truncate text-[15px]">{m.isYou ? "You" : m.name}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{m.kind === "owner" ? "Founder" : m.role}</span>
              </span>
            </span>
            {team.isOwner && m.kind === "member" && (
              confirm === m.id ? (
                <span className="flex shrink-0 items-center gap-3 text-[13px]">
                  Remove {m.name.split(" ")[0]}?
                  <button type="button" onClick={() => onRemove(team, m.id, m.name)} className="text-foreground underline underline-offset-4 cursor-pointer">Remove</button>
                  <button type="button" onClick={() => setConfirm(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm(m.id)} className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Remove</button>
              )
            )}
          </li>
        ))}
      </ul>
    </li>
  )
}
