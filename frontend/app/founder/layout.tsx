"use client"

import type React from "react"
import RequireAuth from "@/components/require-auth"
import { AppShell, type NavItem } from "@/components/shell/app-shell"
import { SomethingBoxProvider } from "@/components/something-box/provider"
import { SomethingBox } from "@/components/something-box/something-box"

const NAV: NavItem[] = [
  { label: "Home", href: "/founder" },
  { label: "Ideas", href: "/founder/ideas" },
  { label: "Something", href: "/founder/something" },
  { label: "Problems", href: "/founder/problems" },
  { label: "Chats", href: "/founder/chats" },
  { label: "Teams", href: "/founder/teams" },
  { label: "Funding", href: "/founder/funding" },
]

// Guard the whole shell, not just the page: the sidebar shows the user's name.
export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="Founder">
      <SomethingBoxProvider role="founder">
        <AppShell role="founder" nav={NAV}>
          {children}
        </AppShell>
        <SomethingBox />
      </SomethingBoxProvider>
    </RequireAuth>
  )
}
