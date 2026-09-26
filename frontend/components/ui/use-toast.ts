"use client"

import { toast as sonner } from "sonner"

// Adapter that keeps the old shadcn `toast({ title, description, variant })` call shape
// but renders through sonner, the one <Toaster /> mounted in app/layout.tsx.
type ToastOptions = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

function toast({ title, description, variant }: ToastOptions) {
  const show = variant === "destructive" ? sonner.error : sonner
  return show(title ?? description ?? "", title ? { description } : undefined)
}

function useToast() {
  return { toast, dismiss: (id?: string | number) => sonner.dismiss(id) }
}

export { useToast, toast }
