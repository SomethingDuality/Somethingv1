"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "Nothing & Something", href: "#duo" },
  { label: "Funding", href: "#funding" },
]

export function NavAvant() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const smoothScrollTo = (id: string) => {
    const el = document.getElementById(id.replace("#", ""))
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top, behavior: "smooth" })
  }

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return
    e.preventDefault()
    smoothScrollTo(href)
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div
          className={cn(
            "mt-4 mb-3 flex items-center justify-between rounded-full px-4 py-2 transition-all duration-500",
            scrolled
              ? "border border-white/10 bg-[#0a0a0c]/80 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
              : "border border-transparent bg-transparent"
          )}
        >
          {/* Logo — TheThing mascot */}
          <Link href="/" className="flex items-center gap-2.5" aria-label="Something home">
            <div className="relative h-7 w-7 rounded-full overflow-hidden">
              <Image
                src="/thing-logo.png"
                alt="Thing — Something mascot"
                fill
                className="object-cover invert"
                sizes="28px"
                priority
              />
            </div>
            <span
              className="text-[15px] font-semibold tracking-tight text-white"
              style={{ fontFamily: "var(--font-outfit, sans-serif)" }}
            >
              Something
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7" role="navigation" aria-label="Main navigation">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={(e) => handleNavClick(e, l.href)}
                className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-300 cursor-pointer"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:block text-[13px] text-white/35 hover:text-white/70 transition-colors duration-300"
            >
              Sign in
            </Link>
            <Link href="/signup">
              <button
                className={cn(
                  "rounded-full text-[13px] font-medium px-5 py-1.5",
                  "bg-white text-[#0a0a0c]",
                  "transition-all duration-300",
                  "hover:bg-[#E3C27A] hover:shadow-[0_0_24px_rgba(227,194,122,0.3)]",
                  "active:scale-[0.97]"
                )}
              >
                Get started
              </button>
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={open}
              className="md:hidden h-8 w-8 flex items-center justify-center rounded-full border border-white/10 text-white/50 hover:text-white/80 transition"
            >
              <span className="text-xs">{open ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            className="md:hidden rounded-2xl border border-white/8 bg-[#0a0a0c]/90 backdrop-blur-xl mx-1 mb-3 px-5 py-4 grid gap-3"
            style={{ animation: "slideDown 0.25s cubic-bezier(0.16,1,0.3,1)" }}
          >
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={(e) => handleNavClick(e, l.href)}
                className="text-sm text-white/50 py-1"
              >
                {l.label}
              </Link>
            ))}
            <div className="border-t border-white/6 pt-3 mt-1 flex flex-col gap-2">
              <Link href="/login" className="text-sm text-white/40 text-center">Sign in</Link>
              <Link href="/signup">
                <button className="w-full rounded-full py-2 text-sm font-medium bg-white text-[#0a0a0c] hover:bg-[#E3C27A] transition-colors">
                  Get started
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px) }
          to { opacity: 1; transform: translateY(0) }
        }
      ` }} />
    </header>
  )
}