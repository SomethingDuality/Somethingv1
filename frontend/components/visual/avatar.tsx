import { cn } from "@/lib/utils"
import { assetUrl } from "@/lib/axios"
import { avatarTone, initials } from "@/lib/visual"

/** A person: their photo, or their initials on a tone that is always the same for their name. */
export function Avatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [bg, fg] = avatarTone(name || "?")
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-medium", className)}
      style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: Math.max(11, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(src)} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
