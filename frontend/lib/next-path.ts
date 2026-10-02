// Where to go after signing in (`?next=`, added by RequireAuth). Only a path on this site counts:
// a check on the string alone misses `/\evil.com` or `/%5Cevil.com`, which browsers read as `//evil.com`.

/** The path, query and hash of `next` when it stays on `origin`, else null. */
export function sameSitePath(next: string | null | undefined, origin: string): string | null {
  if (!next || !next.startsWith("/")) return null
  try {
    const url = new URL(next, origin)
    return url.origin === origin ? url.pathname + url.search + url.hash : null
  } catch {
    return null
  }
}
