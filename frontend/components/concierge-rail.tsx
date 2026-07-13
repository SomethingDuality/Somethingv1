"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, CheckCircle2, Compass, Lightbulb } from "lucide-react"
import Link from "next/link"

interface ConciergeRailProps {
  interests?: string[]
  pendingMilestones?: Array<{ id: string; title: string; amount: string; status: string; description: string }>
  portfolio?: Array<{ id: string; name: string }>
}

export function ConciergeRail({ 
  interests = [], 
  pendingMilestones = [], 
  portfolio = [] 
}: ConciergeRailProps) {
  
  const backedName = portfolio.length > 0 ? portfolio[0].name : null

  return (
    <aside className="hidden xl:block w-[320px] shrink-0 space-y-4">
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground font-medium">Concierge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground/80">
          <div className="text-xs text-muted-foreground">Today</div>
          <ul className="space-y-2">
            {pendingMilestones.length > 0 ? (
              pendingMilestones.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <Bell className="h-4 w-4 text-amber-500 mt-0.5 shrink-0 animate-bounce" />
                  <div className="text-xs leading-normal">
                    Approve escrow release • <span className="font-semibold">{m.title}</span> ({m.amount})
                  </div>
                </li>
              ))
            ) : (
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs leading-normal text-muted-foreground">No pending milestones.</div>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground font-medium">Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground/80">
          <div className="flex flex-wrap gap-2">
            {interests.slice(0, 5).map((t) => (
              <Badge key={t} variant="secondary" className="bg-accent/40 text-foreground border-border/40 text-[10px] font-mono">
                {t}
              </Badge>
            ))}
            {interests.length === 0 && (
              <p className="text-xs text-muted-foreground">No interests configured yet.</p>
            )}
          </div>
          {backedName && (
            <div className="rounded-md border border-border/40 bg-accent/20 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Because you backed</div>
              <div className="mt-1 text-xs text-foreground font-medium">{backedName}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Robotics firmware co‑pilot is trending in your circle.</div>
            </div>
          )}
          <Button asChild className="w-full bg-primary text-primary-foreground hover:opacity-90 text-xs py-1.5 h-9 rounded-lg cursor-pointer">
            <Link href="/investor/search">
              <Compass className="mr-2 h-4 w-4" />
              Explore curated
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground font-medium">Next steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground/80">
          {pendingMilestones.length > 0 ? (
            pendingMilestones.map((m) => (
              <div key={m.id} className="rounded-md border border-border/40 bg-accent/20 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Review requested release for {m.title}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground px-1">No next steps at this time.</div>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}
