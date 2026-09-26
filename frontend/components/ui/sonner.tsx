"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

// The app has one forced dark theme (app/layout.tsx). next-themes' `theme` is the stored or
// "system" value, not the forced one, so a light-mode OS used to get light toasts on a black page.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
