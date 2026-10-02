"use client"

import { useEffect } from "react"
import { Toaster as Sonner, toast, ToasterProps } from "sonner"
import { connectToaster } from "@/components/ui/use-toast"

// The app has one theme, always dark (app/layout.tsx), so toasts are dark whatever the OS prefers.
// Loaded lazily (lazy-toaster.tsx); once mounted it shows the toasts that were waiting for it.
const Toaster = ({ ...props }: ToasterProps) => {
  // Runs after sonner's own effect (children first), so it is listening when the queue flushes.
  useEffect(() => connectToaster(toast), [])

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
