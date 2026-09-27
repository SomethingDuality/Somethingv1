"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AccountSecurity, DeleteAccount } from "@/components/account-security"
import { Page, PageTitle, Section } from "@/components/shell/page"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"

const GHOST_KEY = "investor_ghost_mode"

/** Investor settings: privacy, sign-in and deletion. Profile details live on the profile page. */
export default function InvestorSettingsPage() {
  // Ghost Mode is still a per-browser setting (community plan C5 moves it to the server).
  const [ghostMode, setGhostMode] = useState(false)

  useEffect(() => {
    setGhostMode(localStorage.getItem(GHOST_KEY) === "true")
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ ghost: boolean }>
      if (ce.detail) setGhostMode(ce.detail.ghost)
    }
    window.addEventListener("ghost-mode-change", onChange)
    return () => window.removeEventListener("ghost-mode-change", onChange)
  }, [])

  const changeGhostMode = (on: boolean) => {
    setGhostMode(on)
    localStorage.setItem(GHOST_KEY, String(on))
    window.dispatchEvent(new CustomEvent("ghost-mode-change", { detail: { ghost: on } }))
    toast({ title: on ? "Ghost Mode on" : "Ghost Mode off", description: "Applies in this browser." })
  }

  return (
    <Page className="max-w-[960px]">
      <PageTitle title="Settings">
        Your name, photo, firm and what you invest in are on{" "}
        <Link href="/investor/profile" className="text-foreground underline underline-offset-4">your profile</Link>.
      </PageTitle>

      <Section side title="Privacy">
        <label className="flex items-center justify-between gap-6" id="ghost-mode-privacy-row">
          <span className="text-[15px]">
            Ghost Mode
            <span className="block text-sm text-muted-foreground">
              Look at ideas without showing up in founders&apos; view counts. Applies in this browser for now.
            </span>
          </span>
          <Switch checked={ghostMode} onCheckedChange={changeGhostMode} />
        </label>
      </Section>

      <Section side title="Sign-in">
        <AccountSecurity />
      </Section>

      <Section side title="Delete account">
        <DeleteAccount />
      </Section>
    </Page>
  )
}
