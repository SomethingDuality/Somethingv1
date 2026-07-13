"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Zap,
  TrendingUp,
  MessageCircle,
  Layers,
  Fingerprint,
  SlidersHorizontal,
  ChevronDown,
  PenLine,
  AlertCircle
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const NAV = [
  { title: "Overview", url: "/founder", icon: LayoutDashboard },
  { title: "Ideas", url: "/founder/ideas", icon: Zap },
  { title: "Problems", url: "/founder/problems", icon: AlertCircle },
  { title: "Community funding", url: "/founder/funding", icon: TrendingUp },
  { title: "Chats", url: "/founder/chats", icon: MessageCircle },
  { title: "Nothing & Something", url: "/founder/mutiny", icon: Layers },
  { title: "Profile", url: "/founder/profile", icon: Fingerprint },
  { title: "Settings", url: "/founder/settings", icon: SlidersHorizontal },
]

export function AppFounderSidebar() {
  const pathname = usePathname()

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const fetchProfileData = () => {
      if (typeof window !== "undefined") {
        const storedProfile = localStorage.getItem("founder_profile_data")
        if (storedProfile) {
          try {
            const parsed = JSON.parse(storedProfile)
            if (parsed.avatarUrl !== undefined) setAvatarUrl(parsed.avatarUrl)
            if (parsed.name !== undefined) setUserName(parsed.name)
          } catch (e) {
            console.error("Error reading profile data", e)
          }
        }
      }
    }
    fetchProfileData()
    const handleStorageChange = () => fetchProfileData()
    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("founder-profile-update", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("founder-profile-update", handleStorageChange)
    }
  }, [])

  const getInitials = (n: string) => {
    if (!n) return "A"
    return n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  }

  return (
    <Sidebar variant="inset" collapsible="icon" className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border py-3 px-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg p-1 text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg shrink-0 overflow-hidden bg-black flex items-center justify-center border border-white/15">
                      <img
                        src="/TheThing.png"
                        alt="Something Logo"
                        className="size-8 object-contain invert mix-blend-screen"
                      />
                    </div>
                    <div className="flex flex-col items-start justify-center group-data-[collapsible=icon]:hidden truncate">
                       <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground/95 leading-tight truncate max-w-[130px]">{userName}</span>
                       <span className="text-[11px] font-mono text-sidebar-foreground/40 tracking-widest uppercase leading-tight mt-0.5">Founder Node</span>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 opacity-30 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-popper-anchor-width) bg-popover border border-border text-popover-foreground shadow-2xl rounded-xl backdrop-blur-xl p-1">
                <DropdownMenuItem asChild className="hover:bg-accent cursor-pointer text-xs rounded-lg py-2 font-mono uppercase tracking-wider text-[11px] font-semibold text-muted-foreground hover:text-foreground transition">
                  <Link href="/investor" className="w-full flex items-center">
                    Switch to Investor
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="pt-3 px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.map((item) => {
                const active = pathname === item.url || (item.url !== "/founder" && pathname?.startsWith(item.url))
                return (
                  <SidebarMenuItem key={item.title}>
                    <Link
                      href={item.url}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                        active
                          ? "text-sidebar-foreground bg-sidebar-accent shadow-sm"
                          : "text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      {/* active left bar */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-[1.5px] rounded-full bg-brand-accent" />
                      )}
                      <item.icon
                        className={cn(
                          "h-[15px] w-[15px] shrink-0 transition-colors",
                          active ? "text-brand-accent" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60"
                        )}
                      />
                      <span className="group-data-[collapsible=icon]:hidden tracking-wide font-sans">{item.title}</span>
                    </Link>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto pb-4 px-2">
          <SidebarGroupContent>
            <Link
              href="/founder/ideas?new=true"
              className="flex items-center justify-center gap-2 w-full h-8.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-sm shadow-black/10"
            >
              <PenLine className="h-3.5 w-3.5 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden font-sans">Post new idea</span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="rounded-md bg-sidebar-accent/20 pl-14 pr-2 py-2.5 text-[11px] font-mono leading-relaxed text-sidebar-foreground/30 text-left">
          ⌘ + B to toggle sidebar
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
