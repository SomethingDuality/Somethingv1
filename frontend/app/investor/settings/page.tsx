"use client"

import Link from "next/link"
import { AccountSecurity, DeleteAccount } from "@/components/account-security"
import { Page, PageTitle, Section } from "@/components/shell/page"
import { Switch } from "@/components/ui/switch"
import { useGhostMode } from "@/hooks/use-ghost-mode"

/** Investor settings: privacy, sign-in and deletion. Profile details live on the profile page. */
export default function InvestorSettingsPage() {
  const ghost = useGhostMode()

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
              When you message a founder, they see &ldquo;Ghost investor&rdquo; and the stages you invest in, not your name,
              until you share it. Committing money shares it. Chats you already started keep the setting they began with.
            </span>
          </span>
          <Switch checked={ghost.on} disabled={ghost.saving} onCheckedChange={ghost.set} />
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
