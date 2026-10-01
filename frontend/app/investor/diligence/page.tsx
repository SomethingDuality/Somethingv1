"use client"

import Link from "next/link"
import { Page, PageTitle, Section } from "@/components/shell/page"

/**
 * Diligence isn't built yet (it needs the review service, future F8). This page used to stream
 * a scripted "audit log" and show AI scores from an endpoint that doesn't exist. Per decision R9,
 * investors will see the founder's verified evidence here, not an AI verdict.
 */
export default function DiligencePage() {
  return (
    <Page width="reading">
      <PageTitle title="Diligence">Coming soon.</PageTitle>

      <Section title="What it will show">
        <ul className="max-w-[60ch] list-disc space-y-3 pl-5 text-[15px] leading-relaxed text-muted-foreground">
          <li>The evidence a founder has proven, like a repository, a live product or press coverage, with how each was checked.</li>
          <li>What the founder says but hasn&apos;t proven yet, marked as such.</li>
          <li>Questions worth asking before you commit.</li>
        </ul>
      </Section>

      <p className="mt-12 text-[15px] text-muted-foreground">
        Until then, each idea&apos;s page has the founder&apos;s description and files.{" "}
        <Link href="/investor/search" className="text-foreground underline underline-offset-4">Find ideas</Link>
      </p>
    </Page>
  )
}
