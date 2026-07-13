import { Card, CardContent } from "@/components/ui/card"
import { Users, ShieldCheck, Coins, Search, Handshake, Share2 } from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Idea-aligned matching",
    desc: "We match you with people who share your conviction and complement your skills. Less networking, more teaming.",
  },
  {
    icon: ShieldCheck,
    title: "Protected by design",
    desc: "Mutual NDAs and on-chain idea hashes to prove provenance, discourage copying, and build trust from day one.",
  },
  {
    icon: Coins,
    title: "Community funding",
    desc: "Milestone-based releases from escrow. Funders see inflows, outflows, and receipts in one simple view.",
  },
  {
    icon: Search,
    title: "Startups meet talent",
    desc: "Job seekers discover stealth and seed startups aligned to their principles, stage, and risk appetite.",
  },
  {
    icon: Handshake,
    title: "Founders meet co-founders",
    desc: "Find your opposite. Mut probes viability while Iny optimizes people fit to de-risk founder chemistry.",
  },
  {
    icon: Share2,
    title: "Zero-leak briefs",
    desc: "Share only what’s necessary, watermark drafts, and gate deeper details via mutual agreement flows.",
  },
]

export function Features() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {features.map((f, idx) => (
        <Card key={idx} className="bg-white/[0.04] border-white/10 hover:border-white/20 transition group">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-gradient-to-br from-[#c6a15b]/30 to-emerald-400/20 ring-1 ring-white/10 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-white/90" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="text-sm text-white/70 mt-1">{f.desc}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div id="how" className="sm:col-span-2 lg:col-span-3 mt-4 sm:mt-6">
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-6 sm:p-8">
          <h3 className="text-lg sm:text-xl font-semibold">How Mut & Iny help</h3>
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mt-4 text-sm">
            <div className="rounded-lg border border-white/10 p-4 bg-black/20">
              <div className="text-white/80 font-medium">Assess</div>
              <p className="text-white/70 mt-1">
                Mut questions viability, revenue, and risk. Iny clarifies the promise, users, and team shape.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 p-4 bg-black/20">
              <div className="text-white/80 font-medium">Match</div>
              <p className="text-white/70 mt-1">
                Your idea and profile translate into matching signals for talent, founders, and early funders.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 p-4 bg-black/20">
              <div className="text-white/80 font-medium">Mobilize</div>
              <p className="text-white/70 mt-1">
                Bring a crew together, structure milestones, and unlock funds transparently as results ship.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
