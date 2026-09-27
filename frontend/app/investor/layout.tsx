"use client"

import type React from "react"
import RequireAuth from "@/components/require-auth"
import { AppShell, type NavItem } from "@/components/shell/app-shell"
import { SomethingBoxProvider } from "@/components/something-box/provider"
import { SomethingBox } from "@/components/something-box/something-box"

const NAV: NavItem[] = [
  { label: "Home", href: "/investor" },
  { label: "Discover", href: "/investor/search" },
  { label: "Investments", href: "/investor/investments" },
  { label: "Problems", href: "/investor/problems" },
  { label: "Chats", href: "/investor/chats" },
  // Diligence returns to the menu once the review service exists (future F8).
]

// Guard the whole shell, not just the page: the sidebar shows the user's name.
// Ghost Mode moved from the header into the account menu.
export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="Investor">
      <SomethingBoxProvider role="investor">
        <AppShell role="investor" nav={NAV}>
          {children}
        </AppShell>
        <SomethingBox />
      </SomethingBoxProvider>
    </RequireAuth>
  )
}
