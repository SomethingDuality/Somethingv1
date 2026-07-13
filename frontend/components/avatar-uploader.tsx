"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Camera } from "lucide-react"

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
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="grid place-items-center overflow-hidden rounded-full bg-[#0f1012] ring-1 ring-white/10"
        style={{ width: size, height: size }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src || "/placeholder.svg"} alt="Profile photo" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-medium text-white/80">{initials}</span>
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
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-md border-white/10 text-white hover:bg-white/[0.06] bg-transparent"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>
    </div>
  )
}
