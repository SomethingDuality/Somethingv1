// Deterministic visual identity for real things: an idea's cover colours come from its sectors,
// a person's avatar tone from their name. Same input, same look, everywhere; nothing random.

/** A small stable hash (FNV-1a) → unsigned 32-bit. */
export function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A seeded generator (mulberry32), so a cover is the same on every render. */
export function seeded(seed: number) {
  let a = seed || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [deep background, strong, light] for each sector; muted enough to sit on true black. */
export const SECTOR_PALETTE: Record<string, [string, string, string]> = {
  ai_ml:            ["#1d1838", "#7c5cff", "#c4b5ff"],
  climate:          ["#10291d", "#2fa36b", "#a7e8c4"],
  health:           ["#33141d", "#e0567a", "#f7bccb"],
  fintech:          ["#2e2414", "#d9a441", "#f3d99f"],
  web3:             ["#151a3b", "#4f6bff", "#b3beff"],
  consumer:         ["#33190d", "#f07a3a", "#f9c7a6"],
  saas_b2b:         ["#0d2238", "#2e8bef", "#a6d0fb"],
  dev_tools:        ["#0b2a2e", "#20b8c9", "#a3e8ef"],
  deep_tech:        ["#1c1f25", "#8a94a6", "#d0d6e0"],
  privacy_security: ["#0a2924", "#1fa38a", "#9de4d6"],
  education:        ["#30220c", "#e8a23a", "#f7d8a3"],
  agri_food:        ["#1f2a0e", "#8dbf3b", "#d3eba6"],
}
const NEUTRAL: [string, string, string] = ["#18181b", "#6b6b73", "#c2c2c8"]

/** Up to two sector palettes for an idea (its first sectors), neutral when it has none. */
export function ideaPalettes(sectors: string[] = []): [string, string, string][] {
  const known = sectors.map((s) => SECTOR_PALETTE[s]).filter(Boolean)
  return known.length ? known.slice(0, 2) : [NEUTRAL]
}

/** The strong colour of an idea's first sector (for small accents next to it). */
export function ideaColor(sectors: string[] = []): string {
  return ideaPalettes(sectors)[0][1]
}

const AVATAR_TONES: [string, string][] = [
  ["#2a2140", "#c4b5ff"], ["#13301f", "#a7e8c4"], ["#3a1822", "#f7bccb"], ["#33280f", "#f3d99f"],
  ["#172042", "#b3beff"], ["#3a1d10", "#f9c7a6"], ["#0f2a40", "#a6d0fb"], ["#0e3035", "#a3e8ef"],
]

/** [background, text] for a person's initials, stable per name. */
export function avatarTone(name: string): [string, string] {
  return AVATAR_TONES[hash(name.trim().toLowerCase()) % AVATAR_TONES.length]
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"
}
