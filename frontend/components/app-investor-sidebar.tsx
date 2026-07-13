"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import Image from "next/image"
import {
  Home, Search, Coins, MessageSquareText, UserRound, Settings,
  ChevronDown, BrainCircuit, AlertCircle
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const NAV = [
  { title: "Overview",      url: "/investor",             icon: Home },
  { title: "Search",        url: "/investor/search",      icon: Search },
  { title: "Problems",      url: "/investor/problems",    icon: AlertCircle },
  { title: "Investments",   url: "/investor/investments", icon: Coins },
  { title: "Chats",         url: "/investor/chats",       icon: MessageSquareText },
  { title: "Diligence AI",  url: "/investor/diligence",   icon: BrainCircuit },
  { title: "Profile",       url: "/investor/profile",     icon: UserRound },
  { title: "Settings",      url: "/investor/settings",    icon: Settings },
]

interface AppInvestorSidebarProps {
  accentKey?: string
}

export function AppInvestorSidebar({ accentKey: _accentKey }: AppInvestorSidebarProps) {
  const pathname = usePathname()

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userName,  setUserName]  = useState("Investor")

  useEffect(() => {
    const loadProfile = () => {
      if (typeof window === "undefined") return
      const name = localStorage.getItem("demo_name")
      if (name) setUserName(name)

      const investorProfile = localStorage.getItem("investor_profile_data")
      if (investorProfile) {
        try {
          const p = JSON.parse(investorProfile)
          if (p.name)      setUserName(p.name)
          if (p.avatarUrl) setAvatarUrl(p.avatarUrl)
        } catch { /* ignore */ }
      }
    }
    loadProfile()
    window.addEventListener("investor-profile-update", loadProfile)
    window.addEventListener("storage", loadProfile)
    return () => {
      window.removeEventListener("investor-profile-update", loadProfile)
      window.removeEventListener("storage", loadProfile)
    }
  }, [])

  const getInitials = (n: string) =>
    n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "IN"

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* Header — now with user identity */}
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="justify-between h-14 hover:bg-sidebar-accent transition-colors">
                  <div className="flex items-center gap-2.5">
                    {/* Avatar */}
                    <Avatar className="h-6 w-6 border border-sidebar-border shrink-0">
                      {avatarUrl ? (
                        avatarUrl.startsWith("linear-gradient") ? (
                          <AvatarFallback
                            className="text-[11px] font-bold font-mono uppercase"
                            style={{ background: avatarUrl }}
                          >
                            {getInitials(userName)}
                          </AvatarFallback>
                        ) : (
                          <AvatarImage src={avatarUrl} alt={userName} className="object-cover" />
                        )
                      ) : (
                        <AvatarFallback className="text-[11px] font-bold font-mono uppercase bg-sidebar-accent text-sidebar-foreground">
                          {getInitials(userName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold tracking-tight text-sidebar-foreground leading-tight truncate max-w-[110px]">
                        {userName}
                      </span>
                      <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground leading-tight">
                        Investor Node
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-(--radix-popper-anchor-width) bg-popover border border-border text-popover-foreground shadow-xl rounded-xl">
                <DropdownMenuItem asChild className="hover:bg-accent cursor-pointer text-xs rounded-lg py-2">
                  <Link href="/founder" className="w-full flex items-center gap-2">
                    <span className="text-muted-foreground">↩</span>
                    Switch to Founder
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground px-2 mb-1">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = pathname === item.url || pathname?.startsWith(item.url + "/")
                const isDiligence = item.title === "Diligence AI"
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "transition-all duration-200 rounded-lg",
                        active
                          ? "font-semibold"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                        isDiligence && !active && "text-amber-500/60 hover:text-amber-400"
                      )}
                    >
                      <Link href={item.url} prefetch>
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            active
                              ? "text-[var(--brand-accent)]"
                              : isDiligence
                                ? "text-amber-500/50"
                                : "text-sidebar-foreground/40"
                          )}
                        />
                        <span>{item.title}</span>
                        {isDiligence && (
                          <span className="ml-auto text-[11px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            AI
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="rounded-lg bg-sidebar-accent/60 pl-14 pr-2.5 py-2 text-[10px] leading-tight text-muted-foreground font-mono text-left">
          Press <kbd className="font-semibold text-foreground/60">⌘B</kbd> to toggle sidebar
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}