"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Creature } from "@/components/creature/creature"

// Kept apart from app-shell so the sign-in pages, Terms and Admin don't pull in the shell's
// menus, notifications and inbox poll just to draw the name.

/** Switches <html> to the interior theme while the calling page is mounted (the landing keeps its own). */
export function useInteriorTheme() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add("interior")
    return () => root.classList.remove("interior")
  }, [])
}

/** useInteriorTheme for server-rendered pages (Terms): renders nothing. */
export function InteriorTheme() {
  useInteriorTheme()
  return null
}

export function Wordmark({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-[22px] font-bold leading-none text-foreground"
      style={{ fontFamily: "var(--font-outfit, sans-serif)", letterSpacing: "-0.05em" }}
    >
      {/* The same mascot + name as the landing's nav, drawn as the vector creature. */}
      <Creature size={22} holding />
      something
    </Link>
  )
}
