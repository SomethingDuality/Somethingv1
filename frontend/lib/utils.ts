import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The server's error message from an API error (lib/axios), else `fallback`. Offline gets its own wording. */
export function apiError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { response?: { data?: { message?: string } }; code?: string }
  if (e?.response?.data?.message) return e.response.data.message
  if (!e?.response && e?.code === "ERR_NETWORK") return "Can't reach the server. Check your connection and try again."
  return fallback
}
