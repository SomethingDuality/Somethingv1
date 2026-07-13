"use client"

import Link from "next/link"

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16 bg-black/10">
      <div className="mx-auto max-w-4xl bg-black/50 border border-white/6 rounded-lg p-10">
        <h1 className="text-3xl font-semibold mb-4">Terms &amp; Conditions</h1>
        <p className="text-sm text-white/70 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

        <article className="prose prose-invert max-w-none text-sm leading-relaxed">
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
            <h2>4. Use of Your Data and Model Training</h2>
            <p>
              By using the Service you acknowledge and agree that User Content may be used by Something for
              the purpose of improving our products and services, which may include training machine
              learning models, analytics, and feature development. We will handle data in accordance
              with any applicable privacy policy and will take commercially reasonable measures to
              minimize personally identifiable exposure in model training sets. If you provide content
              marked as confidential or otherwise restricted, you should not post it to the Service.
            </p>
            <p>
              You retain ownership of your User Content. However, by posting content to the Service you
              grant Something a non-exclusive, worldwide, royalty-free license to use, reproduce,
              distribute, and create derivative works from that content for the purpose of operating and
              improving the Service, including training models and anonymized datasets.
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
      </div>
    </main>
  )
}
