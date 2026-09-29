/** Where the founder home's "What are you working on?" box hands its text to the post-idea form.
 *  sessionStorage, not the URL: idea text shouldn't end up in browser history or server logs. */
const KEY = "something:idea-draft"

export function saveIdeaDraft(text: string) {
  try {
    sessionStorage.setItem(KEY, text)
  } catch {
    // storage blocked: the form just opens empty
  }
}

/** The handed-over text. Read-only, so running an effect twice (React dev mode) is harmless. */
export function readIdeaDraft(): string {
  try {
    return sessionStorage.getItem(KEY) ?? ""
  } catch {
    return ""
  }
}

/** Forget the handed-over text once the form has been closed or posted. */
export function clearIdeaDraft() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
}
