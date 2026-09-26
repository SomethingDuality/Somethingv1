"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Creature } from "@/components/creature/creature"

export type NavItem = { label: string; href: string }

type Props = {
  role: "founder" | "investor"
  nav: NavItem[]
  children: React.ReactNode
}

const GHOST_KEY = "investor_ghost_mode"

/**
 * The logged-in frame: a text-only sidebar (wordmark, a few words, notifications, the account),
 * and on small screens a top bar with a full-screen menu. It also switches <html> to the
 * interior theme (true black, Geist, the 13px floor) while it is mounted.
 */
export function AppShell({ role, nav, children }: Props) {
  const pathname = usePathname() ?? ""
  const [menuOpen, setMenuOpen] = useState(false)
  useInteriorTheme()

  // Close the mobile menu after navigating.
  useEffect(() => setMenuOpen(false), [pathname])

  const home = `/${role}`
  const isActive = (href: string) => (href === home ? pathname === home : pathname.startsWith(href))

  const navList = (
    <nav aria-label="Main" className="flex flex-col">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "relative py-1.5 text-[15px] transition-colors",
            isActive(item.href)
              ? "text-foreground before:absolute before:-left-4 before:top-1/2 before:size-1.5 before:-translate-y-1/2 before:rounded-full before:bg-gold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-56 flex-col px-7 pt-8 pb-7">
        <Wordmark href={home} />
        <div className="mt-12">{navList}</div>
        <div className="mt-auto space-y-1">
          <NotificationsDropdown />
          <AccountMenu role={role} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between bg-background px-5 border-b border-border">
        <Wordmark href={home} />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="text-[15px] text-muted-foreground hover:text-foreground cursor-pointer"
          aria-expanded={menuOpen}
        >
          Menu
        </button>
      </header>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background px-5 pt-4 pb-8 flex flex-col" role="dialog" aria-label="Menu">
          <div className="flex h-10 items-center justify-between">
            <Wordmark href={home} />
            <button type="button" onClick={() => setMenuOpen(false)} className="text-[15px] text-muted-foreground cursor-pointer">
              Close
            </button>
          </div>
          <div className="mt-10 [&_a]:text-2xl [&_a]:py-2">{navList}</div>
          <div className="mt-auto space-y-1">
            <NotificationsDropdown />
            <AccountMenu role={role} />
          </div>
        </div>
      )}

      <main className="md:pl-56">
        <div className="px-5 py-10 md:px-12 md:py-16 lg:px-16">{children}</div>
      </main>
    </div>
  )
}

/** Switches <html> to the interior theme while the calling page is mounted (the landing keeps its own). */
export function useInteriorTheme() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add("interior")
    return () => root.classList.remove("interior")
  }, [])
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

function AccountMenu({ role }: { role: "founder" | "investor" }) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [ghost, setGhost] = useState(false)

  // Ghost Mode is still a per-browser setting (community plan C5 moves it to the server).
  useEffect(() => {
    if (role !== "investor") return
    setGhost(localStorage.getItem(GHOST_KEY) === "true")
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ ghost: boolean }>
      if (ce.detail) setGhost(ce.detail.ghost)
    }
    window.addEventListener("ghost-mode-change", onChange)
    return () => window.removeEventListener("ghost-mode-change", onChange)
  }, [role])

  const toggleGhost = () => {
    const on = !ghost
    setGhost(on)
    localStorage.setItem(GHOST_KEY, String(on))
    window.dispatchEvent(new CustomEvent("ghost-mode-change", { detail: { ghost: on } }))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full py-1.5 text-left text-[15px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none">
        <span className="block truncate text-foreground">{user?.name || "Account"}</span>
        {role === "investor" && ghost && <span className="block text-xs text-muted-foreground">Ghost Mode on</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56 bg-popover border-border rounded-xl p-1">
        {user?.email && <p className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</p>}
        <DropdownMenuItem onClick={() => router.push(`/${role}/profile`)} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/${role}/settings`)} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
          Settings
        </DropdownMenuItem>
        {user?.isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
            Admin
          </DropdownMenuItem>
        )}
        {role === "investor" && (
          <DropdownMenuItem onClick={toggleGhost} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
            {ghost ? "Turn Ghost Mode off" : "Turn Ghost Mode on"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={() => logout()} className="px-3 py-2 text-sm cursor-pointer rounded-lg text-destructive focus:text-destructive">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
