"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Menu } from "lucide-react"
import { useState } from "react"

export function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-black/30 bg-black/30 border-b border-white/5">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 h-16 flex items-center justify-between">
        <Link href="#" className="flex items-center gap-2" aria-label="Something home">
          <div className="h-7 w-7 rounded-sm bg-gradient-to-br from-[#e0c27a] via-[#c6a15b] to-[#8a6a2c] ring-1 ring-white/20 shadow-sm" />
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-wide">Something</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/60">{"Nothing • Something"}</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="#features" className="text-sm text-white/80 hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#transparency" className="text-sm text-white/80 hover:text-white transition-colors">
            Funding
          </Link>
          <Link href="#faq" className="text-sm text-white/80 hover:text-white transition-colors">
            FAQ
          </Link>
          <Link href="/login" className="text-sm text-white/80 hover:text-white transition-colors">
            Sign in
          </Link>

          <Link href="/login">
            <Button
              className={cn(
                "bg-[#c6a15b] text-black hover:bg-[#d5b56e]",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_8px_30px_rgba(198,161,91,0.2)]",
              )}
            >
              Get started
            </Button>
          </Link>
          <Link href="/signup" className="text-sm text-white/70 hover:text-white">
            Not having an account? Create
          </Link>
        </nav>

        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/20 hover:bg-white/10"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/5 bg-black/40 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-4 grid gap-3">
            <Link href="#features" className="text-sm text-white/90">
              Features
            </Link>
            <Link href="#transparency" className="text-sm text-white/90">
              Funding
            </Link>
            <Link href="#faq" className="text-sm text-white/90">
              FAQ
            </Link>
            <Link href="#waitlist" className="text-sm text-black">
              <Button className="w-full bg-[#c6a15b] text-black hover:bg-[#d5b56e]">Join waitlist</Button>
            </Link>
            <Link href="/login" className="text-sm text-white/90">
              Get started
            </Link>
            <Link href="/signup" className="text-sm">
              <Button className="w-full bg-[#c6a15b] text-black hover:bg-[#d5b56e]">Not having an account? Create</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
