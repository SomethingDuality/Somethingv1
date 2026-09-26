"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type Props = React.ComponentProps<"input"> & {
  label: string
  labelAside?: React.ReactNode
}

// The same field as the rest of the interior (profiles, the post-idea form, the Something box).
// The border sits on a flex wrapper so the password toggle is a sibling inside it, never an
// absolutely positioned button (Safari drew that one outside the field).
const BOX =
  "flex h-11 w-full items-center rounded-lg border border-input transition-colors focus-within:border-muted-foreground"
const INPUT =
  "h-full min-w-0 flex-1 bg-transparent px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"

/** A labelled input. Password inputs get a Show/Hide toggle. */
export function AuthInput({ label, labelAside, id, type, className, ...rest }: Props) {
  const [show, setShow] = useState(false)
  const isPassword = type === "password"

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[15px] text-foreground">
          {label}
        </label>
        {labelAside}
      </div>
      <div className={BOX}>
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          className={cn(INPUT, className)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="h-full shrink-0 px-3.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  )
}

export function apiErrorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data
  return data?.message || fallback
}
