import type React from "react"
import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { AvatarProvider } from "@/components/avatar-context"
import { LazyToaster } from "@/components/ui/lazy-toaster"

// The landing's two fonts, self-hosted at build time instead of a render-blocking Google Fonts
// stylesheet, with only the weights it uses: Inter 400/500/600 for its text, Outfit 400/600/700
// for its headings and the wordmark (both are variable fonts: one file each, whatever the weights).
// Inter isn't preloaded: only the landing shows it.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", adjustFontFallback: false, preload: false })
const outfit = Outfit({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap", adjustFontFallback: false })

// Just the font's own (hashed) family name, without next/font's metric-matched Arial fallback, so
// the stacks below fall back to Geist exactly as they did: a glyph neither font has (the "→")
// still comes from Geist. (The dev server adds that fallback even with adjustFontFallback off.)
const family = (font: { style: { fontFamily: string } }) => font.style.fontFamily.split(",")[0].trim()

export const metadata: Metadata = {
  title: "Something",
  description:
    "Ideas find their people. Capital finds its purpose. Two AI minds — Nothing and Something — co-pilot your idea into reality.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // One theme, always dark: set here rather than by a theme library's script.
    <html
      lang="en"
      className={`h-full dark ${GeistSans.variable}`}
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <head>
        {/* Every page except the landing uses the interior theme. Setting the class before the
            first paint avoids a flash of the landing's font until React hydrates; the pages'
            useInteriorTheme() keeps it right on client-side navigation. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(location.pathname!=="/")document.documentElement.classList.add("interior")`,
          }}
        />
        <meta name="theme-color" content="#0A0A0C" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --font-inter: ${family(inter)}, var(--font-geist-sans, system-ui, -apple-system, sans-serif);
                --font-outfit: ${family(outfit)}, var(--font-geist-sans, system-ui, -apple-system, sans-serif);
                --font-serif: Georgia, serif;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
              }
            `,
          }}
        />
      </head>
      <body
        className={`${GeistSans.className} min-h-screen bg-background text-foreground antialiased`}
        // The app shell swaps --app-font to Geist; the landing and sign-in pages keep Inter.
        style={{ fontFamily: "var(--app-font, var(--font-inter, system-ui, sans-serif))" }}
      >
        <div className="min-h-screen bg-background text-foreground">
          <AuthProvider>
            <AvatarProvider>{children}</AvatarProvider>
          </AuthProvider>
          {/* Top-center so toasts never sit on the floating Something box (bottom-right). */}
          <LazyToaster position="top-center" richColors />
        </div>
      </body>
    </html>
  )
}
