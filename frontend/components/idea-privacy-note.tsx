import { cn } from "@/lib/utils"

/**
 * The P16 promise, shown under every place an idea is typed. It is only true because deleting
 * an idea really deletes it with its supports, comments, files and commitments (backend
 * src/services/ideaPurge.js). Keep the wording as agreed: no training wording.
 */
export function IdeaPrivacyNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      We never use your ideas to build anything of ours, and we delete them when you ask.
    </p>
  )
}
