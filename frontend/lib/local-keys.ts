// Browser storage the app used before the community moved to the server (problems in C3,
// chats and Ghost Mode in C5). Nothing in it is read any more; it is only removed.
const LEGACY_KEYS = [
  "problems_list",
  "founder_chat_threads", "founder_chat_messages", "investor_threads", "investor_chat_messages",
  "investor_ghost_mode", "founder_notifications", "global_projects", "demo_firm",
  // Name, email and role used to be copied here; nothing reads them, so they shouldn't sit here.
  "demo_name", "demo_email", "demo_role",
]
const LEGACY_PREFIXES = ["vote_", "investor_msgs_", "comments_"] // vote_<id>, investor_msgs_<thread>…

/** Removes the old sample data and votes. Safe to call often; does nothing without storage. */
export function purgeLegacyStorage() {
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k)
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && LEGACY_PREFIXES.some((p) => k.startsWith(p))) stale.push(k)
    }
    for (const k of stale) localStorage.removeItem(k)
  } catch {
    // Private mode or blocked storage: nothing to clean.
  }
}
