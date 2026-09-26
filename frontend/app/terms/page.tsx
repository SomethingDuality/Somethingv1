"use client"

import Link from "next/link"
import { Page } from "@/components/shell/page"
import { Wordmark, useInteriorTheme } from "@/components/shell/app-shell"

export default function TermsPage() {
  useInteriorTheme()

  return (
    <div className="min-h-dvh bg-background text-foreground px-5 pt-8 pb-24 md:px-12">
      <Wordmark href="/" />
      <Page width="reading" className="mt-20 md:mt-28">
        <h1 className="text-[32px] leading-[1.15] text-foreground">Terms</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">Last updated 30 September 2026</p>

        <article className="mt-4 [&_h2]:mt-14 [&_h2]:text-lg [&_h2]:text-foreground [&_p]:mt-4 [&_p]:max-w-[68ch] [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Welcome to Something. These Terms &amp; Conditions {`("Terms")`} govern your access to and use of
              our website, services, and software (collectively, the {`("Service")`}). By creating an account,
              accessing, or using the Service, you agree to be bound by these Terms. If you do not agree,
              please do not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Definitions</h2>
            <p>
              {`"User"`}, {`"you"`} or {`"your"`} means an individual or entity accessing the Service. {`"We"`},
              {`"us"`} or {`"Something"`} means the operator of the Service. {`"User Content"`} means any content
              or information you provide to the Service, including profile information, posts,
              messages, and other data.
            </p>
          </section>

          <section>
            <h2>3. Accounts and Registration</h2>
            <p>
              You must provide accurate and complete registration information and keep your account
              credentials secure. You are responsible for any activity under your account. We reserve
              the right to suspend or terminate accounts that violate these Terms or that use the Service
              in a manner we deem harmful or abusive.
            </p>
          </section>

          <section>
            <h2>4. Your ideas and your data</h2>
            <p>
              Your ideas stay yours. We never use your ideas to build anything of ours, and we take no
              right to make our own versions of them.
            </p>
            <p>
              We use what you give us only to run Something: showing your ideas to the people you
              choose, and matching founders with investors and cofounders. To make matching better, it
              may learn from structured details such as stage, sectors and region. It does not learn
              from your ideas in order to build products or ideas of our own.
            </p>
            <p>
              You grant Something only the permission it needs to store, display and match your User
              Content as described above, for as long as you keep it on the Service.
            </p>
            <p>
              We delete your ideas when you ask. Deleting an idea deletes it along with its likes,
              comments and files, and cancels any commitments made to it. Deleting your account deletes
              everything you posted or committed; comments you wrote on other people&apos;s ideas stay up
              without your name.
            </p>
          </section>

          <section>
            <h2>5. Privacy</h2>
            <p>
              Our Privacy Policy describes how we collect, use, and disclose information from users. The
              Privacy Policy is incorporated into these Terms by reference. If you have questions about
              the Privacy Policy, please contact us using the details in the Contact section below.
            </p>
          </section>

          <section>
            <h2>6. User Conduct and Content</h2>
            <p>
              You agree not to upload or share content that is unlawful, defamatory, harassing,
              infringing, or otherwise objectionable. You are solely responsible for the content you
              submit, and you agree not to post personally identifiable information of others without
              consent.
            </p>
          </section>

          <section>
            <h2>7. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are the exclusive
              property of Something and its licensors. You may not copy, modify, or create derivative
              works based on the Service except as expressly permitted by Something.
            </p>
          </section>

          <section>
            <h2>8. Payments and Subscriptions</h2>
            <p>
              Certain features of the Service may require payment of fees. All fees are non-refundable
              unless otherwise stated. We may change pricing at any time, provided that changes will not
              affect services you have already paid for without notice.
            </p>
          </section>

          <section>
            <h2>9. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED {`"AS IS"`} AND {`"AS AVAILABLE"`}. SOMETHING DISCLAIMS ALL WARRANTIES,
              EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. SOMETHING DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
              OR COMPLETELY SECURE.
            </p>
          </section>

          <section>
            <h2>10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOMETHING SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES ARISING OUT OF OR IN CONNECTION
              WITH THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR AGGREGATE
              LIABILITY FOR DIRECT DAMAGES SHALL NOT EXCEED THE AMOUNTS PAID BY YOU TO SOMETHING IN THE
              SIX (6) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2>11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Something and its officers, directors,
              employees, and agents from and against any claims, liabilities, damages, losses, and
              expenses arising from your violation of these Terms or your breach of any representation
              or warranty.
            </p>
          </section>

          <section>
            <h2>12. Termination</h2>
            <p>
              We may terminate or suspend access to our Service immediately, without prior notice or
              liability, for any reason, including breach of these Terms. Upon termination, your right
              to use the Service will cease immediately. Sections that by their nature should survive
              termination will continue to apply.
            </p>
          </section>

          <section>
            <h2>13. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the jurisdiction
              where Something is incorporated, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2>14. Changes to Terms</h2>
            <p>
              We may modify these Terms from time to time. We will provide notice of material
              changes by posting an updated date at the top of this page. Continued use of the Service
              after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <p>
              For questions about these Terms, please contact us at <Link href="/">support@something.example</Link> or via the contact form on our site.
            </p>
          </section>

          <section>
            <h2>16. Important Notice</h2>
            <p>
              This document is provided for general informational purposes and does not constitute
              legal advice. If you need legal advice, please consult a qualified attorney. By using
              the Service you acknowledge that you have read and understood these Terms.
            </p>
          </section>
        </article>
      </Page>
    </div>
  )
}
