import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { AvatarProvider } from "@/components/avatar-context"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "Something",
  description:
    "Ideas find their people. Capital finds its purpose. Two AI minds — Nothing and Something — co-pilot your idea into reality.",
  themeColor: "#0A0A0C",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full ${GeistSans.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0A0A0C" />
        {/* Google Fonts loaded via link — graceful fallback if offline */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --font-inter: 'Inter', var(--font-geist-sans, system-ui, -apple-system, sans-serif);
                --font-outfit: 'Outfit', var(--font-geist-sans, system-ui, -apple-system, sans-serif);
                --font-serif: 'Newsreader', Georgia, serif;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
              }
              #___next, body > div {
                min-height: 100vh !important;
              }
            `,
          }}
        />
      </head>
      <body
        className={`${GeistSans.className} min-h-screen bg-background text-foreground antialiased`}
        style={{ fontFamily: "var(--font-inter, system-ui, sans-serif)" }}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="min-h-screen bg-background text-foreground">
            <AuthProvider>
              <AvatarProvider>{children}</AvatarProvider>
            </AuthProvider>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}