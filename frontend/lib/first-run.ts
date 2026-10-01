// Browser-only markers for "getting started" steps the server has no record of.
// They only tick a step on the home page; nothing else reads them.
export const TRIED_SOMETHING_KEY = "something:tried"

export function markTriedSomething() {
  try { localStorage.setItem(TRIED_SOMETHING_KEY, "1") } catch { /* private mode */ }
}
