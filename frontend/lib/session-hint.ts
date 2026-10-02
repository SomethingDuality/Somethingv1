// What the browser remembers about the session so pages don't wait on /auth/me to draw, and
// public pages don't ask it at all when nobody has signed in here. Only hints: the server decides,
// and AuthProvider clears both on sign-out and when the session expires. Blocked storage (private
// mode, site data off) throws; that just means no hint.

/** sessionStorage: the last user /auth/me confirmed in this tab. */
const LAST_USER_KEY = "something:last-user"
/** localStorage: someone signed in on this browser and hasn't signed out. */
const HAD_SESSION_KEY = "something:had-session"

export type StoredUser = {
  id?: string
  name?: string
  email?: string
  role?: string
  isAdmin?: boolean
  ghostMode?: boolean
  hasPassword?: boolean
  emailVerified?: boolean
  avatarUrl?: string | null
}

// Just enough to draw the shell; nothing else of /auth/me is kept.
const FIELDS = ["id", "name", "email", "role", "isAdmin", "ghostMode", "hasPassword", "emailVerified", "avatarUrl"] as const

export function pickStoredUser(user: object): StoredUser {
  const out: Record<string, unknown> = {}
  for (const k of FIELDS) {
    const v = (user as Record<string, unknown>)[k]
    if (v !== undefined) out[k] = v
  }
  return out as StoredUser
}

/** Pages anyone can open, where nothing on screen depends on who is signed in. */
export const isPublicPath = (path: string) => path === "/" || path === "/terms"

export function readLastUser(): StoredUser | null {
  try {
    const raw = sessionStorage.getItem(LAST_USER_KEY)
    const u = raw ? JSON.parse(raw) : null
    return u && typeof u === "object" && typeof u.id === "string" && typeof u.role === "string" ? pickStoredUser(u) : null
  } catch {
    return null
  }
}

export function rememberUser(user: object) {
  try {
    sessionStorage.setItem(LAST_USER_KEY, JSON.stringify(pickStoredUser(user)))
  } catch {
    // No hint for the next load: it waits for /auth/me, as before.
  }
  try {
    localStorage.setItem(HAD_SESSION_KEY, "1")
  } catch {
    // Without the mark public pages keep asking /auth/me, as before.
  }
}

export function forgetSession() {
  try {
    sessionStorage.removeItem(LAST_USER_KEY)
  } catch {
    // Nothing was kept.
  }
  try {
    localStorage.removeItem(HAD_SESSION_KEY)
  } catch {
    // Nothing was kept.
  }
}

/** True unless this browser has positively no sign-in (unknown storage counts as maybe). */
export function hadSession(): boolean {
  try {
    return localStorage.getItem(HAD_SESSION_KEY) === "1"
  } catch {
    return true
  }
}
