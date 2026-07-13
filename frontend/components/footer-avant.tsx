import Link from "next/link"

const PRODUCT_LINKS = [
  { label: "Nothing & Something", href: "#duo" },
  { label: "AI Demo", href: "#demo" },
  { label: "Alignment Lab", href: "#match" },
  { label: "Community Funding", href: "#funding" },
]

const TRUST_ITEMS = [
  "Mutual NDAs by default",
  "On-chain idea hashing",
  "Privacy-first matching",
  "Milestone-locked escrow",
]

const LEGAL_ITEMS = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/terms" },
  { label: "Security", href: "/terms" },
]

export function FooterAvant() {
  return (
    <footer className="relative mt-20 border-t border-white/6">
      {/* Top accent line */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(227,194,122,0.25) 25%, rgba(244,114,182,0.15) 50%, rgba(52,211,153,0.25) 75%, transparent 100%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-16 sm:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 text-sm">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-outfit, sans-serif)" }}
              >
                Something
              </span>
            </div>
            <p className="text-white/30 text-xs leading-relaxed max-w-[200px]">
              somewhere between conviction and doubt.
            </p>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="inline-block h-1 w-1 rounded-full bg-[#E3C27A]" />
              <span className="text-[10px] text-white/25 tracking-widest uppercase">Nothing</span>
              <span className="text-white/10 mx-1">·</span>
              <span className="inline-block h-1 w-1 rounded-full bg-[#34D399]" />
              <span className="text-[10px] text-white/25 tracking-widest uppercase">Something</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/20 mb-4">Product</div>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-white/35 hover:text-white/70 transition-colors duration-300 text-[13px]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/20 mb-4">Trust</div>
            <ul className="space-y-2.5">
              {TRUST_ITEMS.map((item) => (
                <li key={item} className="text-white/30 text-[13px]">{item}</li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/20 mb-4">Legal</div>
            <ul className="space-y-2.5">
              {LEGAL_ITEMS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-white/35 hover:text-white/70 transition-colors duration-300 text-[13px]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-6 border-t border-white/4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-white/15">
            © {new Date().getFullYear()} Something. All rights reserved.
          </p>
          <p className="text-[11px] text-white/10 tracking-wide italic">
            ideas find their people. capital finds its purpose.
          </p>
        </div>
      </div>
    </footer>
  )
}
