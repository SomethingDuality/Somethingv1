import { cn } from "@/lib/utils"
import { hash, ideaPalettes, seeded } from "@/lib/visual"

const W = 320
const H = 200

type Shape = { d: string; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }

/**
 * An idea's cover: an abstract composition in its sectors' colours, laid out from its id.
 * The same idea always gets the same cover; two ideas almost never share one. It is decoration
 * that carries real information (the sectors), never a stock image.
 */
export function IdeaCover({
  id,
  sectors,
  className,
  rounded = "rounded-2xl",
}: {
  id: string
  sectors?: string[]
  className?: string
  rounded?: string
}) {
  const [a, b = a] = ideaPalettes(sectors)
  const rnd = seeded(hash(id))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const shapes: Shape[] = []

  // 1. A large disc anchored to the top or bottom edge: the cover's weight.
  const r1 = 80 + rnd() * 60
  const cx1 = 40 + rnd() * (W - 80)
  const cy1 = rnd() > 0.5 ? H + r1 * 0.25 : -r1 * 0.25
  shapes.push({ d: circle(cx1, cy1, r1), fill: a[1] })

  // 2. A half-disc on the grid, turned to one of four sides.
  const s2 = 70 + rnd() * 40
  const x2 = Math.round(rnd() * 3) * (W / 4)
  const y2 = Math.round(rnd() * 2) * (H / 3)
  shapes.push({ d: halfDisc(x2, y2, s2, pick([0, 90, 180, 270])), fill: b[2], opacity: 0.92 })

  // 3. A quarter circle tucked into a corner.
  const s3 = 60 + rnd() * 50
  const corner = pick([[0, 0], [W, 0], [0, H], [W, H]] as const)
  shapes.push({ d: quarter(corner[0], corner[1], s3), fill: b[1], opacity: 0.85 })

  // 4. A ring and a bar for rhythm.
  const cx4 = 30 + rnd() * (W - 60)
  const cy4 = 30 + rnd() * (H - 60)
  shapes.push({ d: circle(cx4, cy4, 14 + rnd() * 18), stroke: a[2], strokeWidth: 5 })
  const vertical = rnd() > 0.5
  const t = 10 + rnd() * 10
  shapes.push({
    d: vertical
      ? rect(40 + rnd() * (W - 80), 0, t, H)
      : rect(0, 30 + rnd() * (H - 60), W, t),
    fill: a[2],
    opacity: 0.18,
  })

  return (
    <div className={cn("relative overflow-hidden", rounded, className)} style={{ backgroundColor: a[0] }} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {shapes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={s.fill ?? "none"}
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
            opacity={s.opacity ?? 1}
          />
        ))}
      </svg>
    </div>
  )
}

function circle(cx: number, cy: number, r: number) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
}

// A half-disc whose flat side faces `rot` degrees (0 = flat side down).
function halfDisc(x: number, y: number, size: number, rot: number) {
  const r = size / 2
  const cx = x + r
  const cy = y + r
  const pts: Record<number, string> = {
    0: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`,
    90: `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`,
    180: `M ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx - r} ${cy} Z`,
    270: `M ${cx} ${cy + r} A ${r} ${r} 0 0 1 ${cx} ${cy - r} Z`,
  }
  return pts[rot]
}

// A quarter circle filling the given corner.
function quarter(x: number, y: number, r: number) {
  const sx = x === 0 ? 1 : -1
  const sy = y === 0 ? 1 : -1
  const sweep = sx * sy > 0 ? 0 : 1
  return `M ${x} ${y} L ${x + sx * r} ${y} A ${r} ${r} 0 0 ${sweep} ${x} ${y + sy * r} Z`
}

function rect(x: number, y: number, w: number, h: number) {
  return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`
}
