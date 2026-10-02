import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// 5050, not 5000: macOS AirPlay Receiver already listens on 5000.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

/** Uploaded files are stored as API-relative paths (/uploads/...); absolute URLs (e.g. Google photos) pass through. */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith('/uploads/') ? `${API_BASE_URL}${path}` : path;
}

/** An idea file the server stored (`/uploads/ideas/<idea>/<random>.<ext>`); older records could hold any URL. */
export const isUploadPath = (path?: string | null): path is string =>
  typeof path === 'string' && /^\/uploads\/ideas\/[a-f0-9]{24}\/[a-f0-9]{32}\.[a-z0-9]{2,4}$/.test(path);

/**
 * Opens an idea's file in a new tab. Files are served only to signed-in people who may see the
 * idea, and a plain link would get a 401 once the 15-minute sign-in cookie lapses, so this
 * refreshes it first (the tab opens synchronously so popup blockers allow it).
 */
export async function openUpload(path: string): Promise<void> {
  // Only our own stored files: navigating by `location` would skip React's link sanitising.
  if (!isUploadPath(path)) return;
  const url = `${API_BASE_URL}${path}`;
  const tab = window.open('', '_blank');
  try {
    await apiClient.get('/auth/me');
  } catch {
    tab?.close();
    return;
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = url;
  } else {
    window.location.assign(url);
  }
}


/** The server said "not signed in" or "not allowed", as opposed to being offline or failing. */
export const isAuthFailure = (err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
};

let refreshing: Promise<void> | null = null;

/**
 * Renews the sign-in cookies. The server rotates the refresh token on every call, so two refreshes
 * at once would sign the user out: every caller in this tab shares one request, and tabs take
 * turns through a Web Lock where the browser has them (the one that waits sends the new cookie).
 * Only a 401/403 means the session is over; that is announced once, here.
 */
export function refreshSession(): Promise<void> {
  if (!refreshing) {
    const run = async () => { await apiClient.post('/auth/refresh'); };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const done: Promise<unknown> = locks ? locks.request('something-auth-refresh', run) : run();
    refreshing = done
      .then(() => undefined)
      .catch((err) => {
        // Refused: the session is over. Tell AuthProvider and let RequireAuth decide where to
        // go. Never redirect here — public pages (landing, terms) must stay put for logged-out
        // visitors. Offline or a 5xx just fails this call; the next one tries again.
        if (isAuthFailure(err) && typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
        throw err;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (err: { response?: { status?: number }; config?: InternalAxiosRequestConfig & { _retry?: boolean } }) => {
    const originalRequest = err.config
    const status = err?.response?.status

    // Only attempt refresh on 401, never on 429 or other errors.
    // Also skip if this is already a retry, or the call is to /auth/refresh itself.
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      // Don't attempt refresh while on auth pages — avoids reload loops
      (typeof window === 'undefined' || (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')))
    ) {
      originalRequest._retry = true;
      // Requests that 401 together wait for the same refresh, then go again.
      await refreshSession();
      return apiClient(originalRequest);
    }

    return Promise.reject(err);
  }
);

export default apiClient;
