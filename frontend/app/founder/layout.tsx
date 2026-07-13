"use client"

import React, { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppFounderSidebar } from "@/components/app-founder-sidebar"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Search, Plus, LogOut, UserRound, Settings, RefreshCw, Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { useTheme } from "next-themes"
import RequireAuth from "@/components/require-auth"

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Sync avatar, name, and accent from local storage
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [accentKey, setAccentKey] = useState("emerald")

  const fetchProfileData = () => {
    if (typeof window !== "undefined") {
      let currentName = ""
      let currentEmail = ""

      const storedProfile = localStorage.getItem("founder_profile_data")
      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile)
          if (parsed.avatarUrl !== undefined) setAvatarUrl(parsed.avatarUrl)
          if (parsed.name !== undefined) currentName = parsed.name
          if (parsed.email !== undefined) currentEmail = parsed.email
        } catch (e) {
          console.error("Error reading profile data", e)
        }
      }

      const demoName = localStorage.getItem("demo_name")
      const demoEmail = localStorage.getItem("demo_email")
      if (demoName) currentName = demoName
      if (demoEmail) currentEmail = demoEmail

      setUserName(currentName || "Founder")
      setUserEmail(currentEmail || "founder@something.to")

      const storedAccent = localStorage.getItem("founder_settings_accent")
      if (storedAccent) {
        setAccentKey(storedAccent)
      } else {
        setAccentKey(theme === "dark" ? "violet" : "emerald")
      }
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchProfileData()
    // Event listener to sync settings changes in multiple tabs
    const handleStorageChange = () => fetchProfileData()
    const handleAccentUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ accent: string }>
      if (ce.detail?.accent) setAccentKey(ce.detail.accent as "emerald" | "indigo" | "violet" | "amber")
    }
    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("founder-profile-update", handleStorageChange)
    window.addEventListener("founder-accent-update", handleAccentUpdate)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("founder-profile-update", handleStorageChange)
      window.removeEventListener("founder-accent-update", handleAccentUpdate)
    }
  }, [theme])

  useEffect(() => {
    if (typeof window !== "undefined" && mounted) {
      const storedAccent = localStorage.getItem("founder_settings_accent")
      if (!storedAccent) {
        setAccentKey(theme === "dark" ? "violet" : "emerald")
      }
    }
  }, [theme, mounted])

  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return
    const isDark = theme !== "light"
    const root = document.documentElement

    type ThemeTokens = {
      brand: string
      bg: string
      bgOklch: string
      fg: string
      fgOklch: string
      sidebar: string
      sidebarFg: string
      sidebarBorder: string
      border: string
      muted: string
      mutedFg: string
      accent: string
      fontWeight: string   // e.g. "400" | "450" | "500"
      letterSpacing: string
    }

    // ─── Dark mode palettes ────────────────────────────────────────────────
    const darkPalettes: Record<string, ThemeTokens> = {
      emerald: {
        brand:         "#8EA38E",
        bg:            "#0b0d0b",
        bgOklch:       "oklch(0.07 0.004 140)",
        fg:            "#E8EDE8",
        fgOklch:       "oklch(0.94 0.006 140)",
        sidebar:       "#090b09",
        sidebarFg:     "#D4DDD4",
        sidebarBorder: "#181e18",
        border:        "#1a201a",
        muted:         "#141814",
        mutedFg:       "oklch(0.58 0.008 140)",
        accent:        "#141814",
        fontWeight:    "380",
        letterSpacing: "-0.01em",
      },
      indigo: {
        brand:         "#D4CFC4",
        bg:            "#0e0d0c",
        bgOklch:       "oklch(0.08 0.003 60)",
        fg:            "#F0EDE6",
        fgOklch:       "oklch(0.96 0.005 60)",
        sidebar:       "#0b0a09",
        sidebarFg:     "#DDD9D0",
        sidebarBorder: "#1c1a18",
        border:        "#1e1c19",
        muted:         "#161411",
        mutedFg:       "oklch(0.6 0.006 60)",
        accent:        "#161411",
        fontWeight:    "350",
        letterSpacing: "0.005em",
      },
      violet: {
        brand:         "#8293A4",
        bg:            "#0b0d0f",
        bgOklch:       "oklch(0.07 0.005 240)",
        fg:            "#E2E8EE",
        fgOklch:       "oklch(0.93 0.007 240)",
        sidebar:       "#090b0d",
        sidebarFg:     "#CDD7E2",
        sidebarBorder: "#161e26",
        border:        "#18202a",
        muted:         "#121820",
        mutedFg:       "oklch(0.58 0.01 240)",
        accent:        "#121820",
        fontWeight:    "400",
        letterSpacing: "0em",
      },
      amber: {
        brand:         "#C88E72",
        bg:            "#100c0b",
        bgOklch:       "oklch(0.075 0.008 30)",
        fg:            "#EDE7E2",
        fgOklch:       "oklch(0.94 0.006 30)",
        sidebar:       "#0d0909",
        sidebarFg:     "#DDD4CC",
        sidebarBorder: "#211a18",
        border:        "#231c19",
        muted:         "#181210",
        mutedFg:       "oklch(0.58 0.01 30)",
        accent:        "#181210",
        fontWeight:    "420",
        letterSpacing: "0.01em",
      },
    }

    // ─── Light mode palettes ───────────────────────────────────────────────
    const lightPalettes: Record<string, ThemeTokens> = {
      emerald: {
        brand:         "#5C725E",
        bg:            "#F5F6F3",
        bgOklch:       "oklch(0.97 0.005 140)",
        fg:            "#1A2B1A",
        fgOklch:       "oklch(0.16 0.01 140)",
        sidebar:       "#EAEEE8",
        sidebarFg:     "#263226",
        sidebarBorder: "#D4DAD2",
        border:        "#D0D8CE",
        muted:         "#E4EAE2",
        mutedFg:       "oklch(0.42 0.012 140)",
        accent:        "#DCE4DA",
        fontWeight:    "400",
        letterSpacing: "-0.01em",
      },
      indigo: {
        brand:         "#7C7A72",
        bg:            "#FAF9F6",
        bgOklch:       "oklch(0.99 0.003 70)",
        fg:            "#28261E",
        fgOklch:       "oklch(0.17 0.008 70)",
        sidebar:       "#F0EDE6",
        sidebarFg:     "#32302A",
        sidebarBorder: "#DDD9D0",
        border:        "#D8D4C8",
        muted:         "#EBE8E0",
        mutedFg:       "oklch(0.44 0.008 70)",
        accent:        "#E4E0D6",
        fontWeight:    "350",
        letterSpacing: "0.005em",
      },
      violet: {
        brand:         "#5C6C7C",
        bg:            "#F3F5F7",
        bgOklch:       "oklch(0.97 0.005 240)",
        fg:            "#1A2230",
        fgOklch:       "oklch(0.16 0.014 240)",
        sidebar:       "#E8ECF0",
        sidebarFg:     "#263040",
        sidebarBorder: "#CDD6DF",
        border:        "#C8D2DC",
        muted:         "#E0E6EE",
        mutedFg:       "oklch(0.42 0.014 240)",
        accent:        "#D8E0EA",
        fontWeight:    "400",
        letterSpacing: "0em",
      },
      amber: {
        brand:         "#A56B4E",
        bg:            "#FAF6F5",
        bgOklch:       "oklch(0.985 0.006 30)",
        fg:            "#2E1A14",
        fgOklch:       "oklch(0.17 0.018 30)",
        sidebar:       "#F0E8E4",
        sidebarFg:     "#3C2A22",
        sidebarBorder: "#DDD0C8",
        border:        "#D8C8C0",
        muted:         "#EAE0DA",
        mutedFg:       "oklch(0.44 0.016 30)",
        accent:        "#E2D4CC",
        fontWeight:    "420",
        letterSpacing: "0.01em",
      },
    }

    const palettes = isDark ? darkPalettes : lightPalettes
    const t = palettes[accentKey] || palettes.emerald

    root.style.setProperty("--brand-accent",            t.brand)
    root.style.setProperty("--background-color",        t.bg)
    root.style.setProperty("--background",              t.bgOklch)
    root.style.setProperty("--foreground",              t.fgOklch)
    root.style.setProperty("--card",                    t.bgOklch)
    root.style.setProperty("--card-foreground",         t.fgOklch)
    root.style.setProperty("--popover",                 t.bgOklch)
    root.style.setProperty("--popover-foreground",      t.fgOklch)
    root.style.setProperty("--primary",                 t.fgOklch)
    root.style.setProperty("--primary-foreground",      t.bgOklch)
    root.style.setProperty("--sidebar",                 t.sidebar)
    root.style.setProperty("--sidebar-foreground",      t.sidebarFg)
    root.style.setProperty("--sidebar-border",          t.sidebarBorder)
    root.style.setProperty("--sidebar-accent",          t.accent)
    root.style.setProperty("--sidebar-accent-foreground", t.fg)
    root.style.setProperty("--border",                  t.border)
    root.style.setProperty("--input",                   t.border)
    root.style.setProperty("--muted",                   t.muted)
    root.style.setProperty("--muted-foreground",        t.mutedFg)
    root.style.setProperty("--accent",                  t.accent)
    root.style.setProperty("--accent-foreground",       t.fgOklch)
    // Per-theme typography tweaks
    root.style.setProperty("--theme-font-weight",       t.fontWeight)
    root.style.setProperty("--theme-letter-spacing",    t.letterSpacing)
    
    const rawWeight = parseInt(t.fontWeight) || 400
    const bodyWeight = isDark ? Math.max(380, rawWeight) : Math.max(420, rawWeight + 20)
    root.style.setProperty("--theme-body-weight",       bodyWeight.toString())
  }, [accentKey, theme, mounted])


  const getInitials = (n: string) => {
    if (!n) return "A"
    return n
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  const seg = pathname?.split("/").filter(Boolean)[1]
  const section =
    {
      ideas: "Ideas",
      funding: "Community funding",
      chats: "Chats",
      mutiny: "Nothing & Something",
      profile: "Profile",
      settings: "Settings",
    }[seg ?? ""] ?? "Overview"

  // Accent styling mappings with new premium hardware palette
  const accentStyles = {
    emerald: {
      ring: "focus-visible:ring-[#8EA38E]/20 focus-visible:border-[#8EA38E]/30",
      avatarGlow: "border-[#8EA38E]/45",
    },
    indigo: {
      ring: "focus-visible:ring-[#E2DFD5]/20 focus-visible:border-[#E2DFD5]/30",
      avatarGlow: "border-[#E2DFD5]/45",
    },
    violet: {
      ring: "focus-visible:ring-[#8293A4]/20 focus-visible:border-[#8293A4]/30",
      avatarGlow: "border-[#8293A4]/45",
    },
    amber: {
      ring: "focus-visible:ring-[#C88E72]/20 focus-visible:border-[#C88E72]/30",
      avatarGlow: "border-[#C88E72]/45",
    },
  }[accentKey as "emerald" | "indigo" | "violet" | "amber"] || {
    ring: "focus-visible:ring-[#8EA38E]/20 focus-visible:border-[#8EA38E]/30",
    avatarGlow: "border-[#8EA38E]/45",
  }

  return (
    <SidebarProvider>
      <AppFounderSidebar />
      <SidebarInset className="bg-[var(--background-color)] text-foreground relative overflow-x-hidden">
        <Suspense fallback={<div className="p-4">Loading...</div>}>
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-sidebar px-6 relative z-50">
            <SidebarTrigger className="-ml-1 text-foreground/80 hover:text-foreground transition-colors" />
            <Separator orientation="vertical" className="mr-2 h-5 bg-border" />
            
            <nav className="flex items-center gap-2 sm:gap-3">
              <Link href="/founder" className="text-sm sm:text-base font-semibold tracking-tight text-foreground/90 hover:text-foreground transition-colors">
                Founder
              </Link>
              <span className="text-foreground/20">/</span>
              <span className="text-foreground/60 text-xs sm:text-sm font-mono uppercase tracking-wider">{section}</span>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              {/* Search Bar Node with keyboard shortcut badge */}
              <div className="relative hidden md:block group">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30 group-hover:text-foreground/50 transition-colors" />
                <Input
                  placeholder="Search ideas, investors, team…"
                  className={cn(
                    "h-8 w-[280px] pl-9 pr-10 bg-background/40 border-border text-xs text-foreground placeholder:text-foreground/30 rounded-lg focus-visible:ring-offset-0 focus-visible:ring-1 transition-all",
                    accentStyles.ring
                  )}
                />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 z-10 inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-foreground/5 px-1.5 font-mono text-[11px] font-medium text-foreground/40">
                  <span className="text-[11px]">⌘</span>K
                </kbd>
              </div>

              {/* Plus Idea trigger button */}
              <Button
                size="sm"
                onClick={() => router.push("/founder/ideas?new=true")}
                className="h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wide transition-all active:scale-[0.98] cursor-pointer shrink-0 px-3"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                New idea
              </Button>

              {/* Notifications bell */}
              <NotificationsDropdown />

              {/* Theme Toggle option */}
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="h-8 w-8 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full transition-colors cursor-pointer shrink-0"
                  aria-label="Toggle theme mode"
                >
                  {theme === "dark" ? (
                    <Sun className="h-3.5 w-3.5" />
                  ) : (
                    <Moon className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}

              {/* dynamic avatar dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "flex items-center rounded-full border p-0.5 transition cursor-pointer select-none relative focus:outline-none",
                    accentStyles.avatarGlow
                  )}>
                    <Avatar className="h-7 w-7 border border-border">
                      {avatarUrl ? (
                        avatarUrl.startsWith("linear-gradient") ? (
                          <AvatarImage src="" alt="" className="hidden" />
                        ) : (
                          <AvatarImage src={avatarUrl} alt={userName} className="object-cover" />
                        )
                      ) : null}
                      <AvatarFallback
                        className="text-foreground text-[11px] font-bold font-mono uppercase bg-accent"
                        style={{ background: avatarUrl && avatarUrl.startsWith("linear-gradient") ? avatarUrl : undefined }}
                      >
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent className="w-56 bg-popover border border-border text-popover-foreground shadow-2xl rounded-xl backdrop-blur-xl p-1.5" align="end">
                  <DropdownMenuLabel className="px-2.5 py-2">
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-xs font-semibold text-foreground">{userName}</span>
                      <span className="text-[11px] text-muted-foreground font-mono leading-none">{userEmail}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  
                  <DropdownMenuItem onClick={() => router.push("/founder/profile")} className="hover:bg-accent cursor-pointer text-xs rounded-lg py-2 flex items-center gap-2 font-mono uppercase tracking-wider text-[11px] font-semibold text-muted-foreground hover:text-foreground transition">
                    <UserRound className="h-3.5 w-3.5 opacity-60" /> Profile Workspace
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/founder/settings")} className="hover:bg-accent cursor-pointer text-xs rounded-lg py-2 cursor-pointer flex items-center gap-2 font-mono uppercase tracking-wider text-[11px] font-semibold text-muted-foreground hover:text-foreground transition">
                    <Settings className="h-3.5 w-3.5 opacity-60" /> Settings Panel
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-border" />
                  
                  <DropdownMenuItem onClick={() => router.push("/investor")} className="hover:bg-accent cursor-pointer text-xs rounded-lg py-2 cursor-pointer flex items-center gap-2 font-mono uppercase tracking-wider text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition">
                    <RefreshCw className="h-3.5 w-3.5 opacity-60" /> Switch to Investor
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-border" />
                  
                  <DropdownMenuItem onClick={() => logout()} className="hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs rounded-lg py-2 cursor-pointer flex items-center gap-2 font-mono uppercase tracking-wider text-[11px] font-semibold transition">
                    <LogOut className="h-3.5 w-3.5 opacity-60" /> Log Out Key
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </header>
        </Suspense>

        <div className="flex-1 animate-fade-up w-full flex flex-col">
          <RequireAuth>
            {children}
          </RequireAuth>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
