"use client"

import dynamic from "next/dynamic"

// Toasts only ever answer something the user did, so sonner loads after the page instead of with
// it. Toasts asked for before it arrives wait in components/ui/use-toast.ts and show then.
export const LazyToaster = dynamic(() => import("@/components/ui/sonner").then((m) => m.Toaster), { ssr: false })
