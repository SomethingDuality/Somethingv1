import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-white/3 border border-white/8 w-full min-w-0 rounded-lg px-4 text-sm h-12",
        "transition-colors shadow-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-amber-400/25 focus-visible:border-amber-400",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
