"use client"

import type { toast as SonnerToast } from "sonner"

// Adapter that keeps the old shadcn `toast({ title, description, variant })` call shape
// but renders through sonner, the one <Toaster /> mounted in app/layout.tsx. Sonner loads with
// that Toaster, after the page; a toast asked for before then waits here and shows once it's up.
type ToastOptions = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

let sonner: typeof SonnerToast | null = null
const waiting: ToastOptions[] = []

/** Called by the Toaster once it is listening. */
export function connectToaster(t: typeof SonnerToast) {
  sonner = t
  for (const options of waiting.splice(0)) toast(options)
}

function toast({ title, description, variant }: ToastOptions) {
  if (!sonner) {
    waiting.push({ title, description, variant })
    return
  }
  const show = variant === "destructive" ? sonner.error : sonner
  return show(title ?? description ?? "", title ? { description } : undefined)
}

function useToast() {
  return { toast, dismiss: (id?: string | number) => sonner?.dismiss(id) }
}

export { useToast, toast }
