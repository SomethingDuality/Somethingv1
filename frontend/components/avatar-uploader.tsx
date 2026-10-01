"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import { avatarTone } from "@/lib/visual"

export function AvatarUploader({
  name,
  src,
  onChange,
  size = 80,
  className,
}: {
  name: string
  src: string | null
  onChange: (file: File | null, previewUrl: string | null) => void
  size?: number
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div
        className="grid place-items-center overflow-hidden rounded-full"
        style={{ width: size, height: size, backgroundColor: avatarTone(name || "?")[0], color: avatarTone(name || "?")[1] }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src || "/placeholder.svg"} alt="Profile photo" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[15px]">{initials}</span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            if (!file) {
              onChange(null, null)
              return
            }
            const url = URL.createObjectURL(file)
            onChange(file, url)
          }}
        />
        <button
          type="button"
          className="text-[15px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {src ? "Change photo" : "Upload photo"}
        </button>
      </div>
    </div>
  )
}
