import { cn } from "@/lib/utils"

/**
 * A still placeholder in the shape of what's loading (no shimmer: motion only answers an action).
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block rounded-md bg-surface-2", className)} />
}

/** A few placeholder rows for a list that is loading. */
export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-5", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className={i % 2 ? "h-4 w-1/2" : "h-4 w-2/3"} />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}
