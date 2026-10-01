"use client"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/** Sharing your name in one chat: explicit, and it can't be taken back. */
export function RevealDialog({ open, onOpenChange, otherName, onConfirm, busy }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  otherName: string
  onConfirm: () => void
  busy?: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-2xl border-border bg-popover p-8">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-xl font-medium">Share your name with {otherName}?</AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            They&apos;ll see your name and firm in this chat, and any later chat with them starts with your name.
            This can&apos;t be undone. Your other chats stay as they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-3">
          <AlertDialogCancel className="rounded-full">Not now</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
            {busy ? "Sharing…" : "Share my name"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
