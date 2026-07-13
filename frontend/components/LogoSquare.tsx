import { useState } from "react"

const variants = [
  "bg-gradient-to-br from-white/70 to-white/30",
  "bg-gradient-to-tr from-pink-500/70 to-purple-500/30",
  "bg-gradient-to-br from-green-500/70 to-emerald-300/30",
]

export function LogoSquare() {
  const [index, setIndex] = useState(0)

  return (
    <div
      onClick={() => setIndex((index + 1) % variants.length)}
      className={`h-5 w-5 rounded-sm cursor-pointer transition-all ${variants[index]}`}
    />
  )
}
