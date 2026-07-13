import { Button } from "@/components/ui/button"
import { AIduoDemo } from "./ai-duo-demo"
import WaitlistForm from "./waitlist-form"

export function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 sm:px-8 pt-14 sm:pt-20 pb-8 sm:pb-12">
      {/* top tag */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c6a15b]" aria-hidden="true" />
          Premium early access
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
            Where bold ideas meet their crew.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/70 max-w-xl">
            Mutiny connects people with shared conviction. Two AIs&mdash;<span className="text-white">Mut</span> (the
            sharp investor) and <span className="text-white">Iny</span> (the empathetic CEO)&mdash;co-pilot you to
            co-founders, teams, and funders.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a href="#demo">
              <Button className="bg-[#c6a15b] text-black hover:bg-[#d5b56e] px-6">Try the duo</Button>
            </a>
            <a href="#how">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
                How it works
              </Button>
            </a>
          </div>

          <div id="waitlist" className="mt-8 sm:mt-10 max-w-md">
            <WaitlistForm />
            <p className="text-xs text-white/50 mt-2">
              Your ideas are protected: mutual NDAs + on-chain idea hashes to prove provenance.
            </p>
          </div>
        </div>

        <div id="demo" className="lg:pl-4">
          <AIduoDemo />
          <p className="sr-only">
            Interactive demo showcasing two AI perspectives (investor and CEO) analyzing your idea.
          </p>
        </div>
      </div>
    </section>
  )
}
