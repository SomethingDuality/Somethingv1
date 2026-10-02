"use client"

import { Wordmark, useInteriorTheme } from "@/components/shell/wordmark"

type Props = {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

// What Something is, in one line (chat/brief.md). The left half on laptops.
const STATEMENT = "Founders and investors find each other through proof, not who they know."

/**
 * Shared layout for login, signup, forgot and reset, in the interior style. Phones get one
 * column under the wordmark. From lg the page splits in two: the statement in large type on
 * the left, the form vertically centred on the right. No card, no glow, no entrance animation.
 */
export function AuthShell({ title, subtitle, children, footer }: Props) {
  useInteriorTheme()

  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-2">
      <div className="px-5 pt-8 md:px-12 lg:flex lg:min-h-dvh lg:flex-col lg:pb-12 lg:pl-16">
        <Wordmark href="/" />
        <p className="hidden lg:block lg:my-auto lg:max-w-[14ch] lg:text-[52px] lg:leading-[1.08] lg:tracking-[-0.02em] lg:text-foreground">
          {STATEMENT}
        </p>
      </div>

      <main className="px-5 pb-16 md:px-12 lg:flex lg:min-h-dvh lg:flex-col lg:justify-center lg:py-16 lg:pr-16">
        <div className="mt-20 w-full max-w-sm md:mt-28 lg:mt-0">
          <h1 className="text-[32px] leading-[1.15] text-foreground">{title}</h1>
          {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}

          <div className="mt-10 space-y-8">{children}</div>

          {footer && <div className="mt-12 text-[15px] text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

/** The error line used by every auth form. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[15px] leading-relaxed text-destructive">
      {children}
    </p>
  )
}
