"use client"

import Link from "next/link"
import { AccountSecurity, DeleteAccount } from "@/components/account-security"
import { Page, PageTitle, Section } from "@/components/shell/page"

/** Founder settings: sign-in and deletion. Profile details are edited on the profile page only. */
export default function FounderSettingsPage() {
  return (
    <Page className="max-w-[960px]">
      <PageTitle title="Settings">
        Your name, photo, headline and links are on{" "}
        <Link href="/founder/profile" className="text-foreground underline underline-offset-4">your profile</Link>.
      </PageTitle>

      <Section side title="Sign-in">
        <AccountSecurity />
      </Section>

      <Section side title="Delete account">
        <DeleteAccount />
      </Section>
    </Page>
  )
}
