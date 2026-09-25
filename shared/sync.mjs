// Copies the shared JSON files into each app, so each app only imports from its own folder.
//   node shared/sync.mjs          write the copies
//   node shared/sync.mjs --check  exit 1 if a copy has drifted (used by tests)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const FILES = ["taxonomy.json", "question-bank.json"]
const TARGETS = ["frontend/lib/shared", "Mutiny_backend_private/src/shared"]
const check = process.argv.includes("--check")

let drift = false
for (const file of FILES) {
  const source = readFileSync(join(here, file), "utf8")
  JSON.parse(source) // fail loudly on invalid JSON
  for (const target of TARGETS) {
    const dir = join(root, target)
    const out = join(dir, file.replace(".json", ".generated.json"))
    const current = existsSync(out) ? readFileSync(out, "utf8") : null
    if (current === source) continue
    if (check) {
      console.error(`[sync] ${out} is out of date — run: node shared/sync.mjs`)
      drift = true
    } else {
      mkdirSync(dir, { recursive: true })
      writeFileSync(out, source)
      console.log(`[sync] wrote ${out}`)
    }
  }
}
if (drift) process.exit(1)
