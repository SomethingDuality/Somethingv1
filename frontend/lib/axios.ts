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


let isRefreshing = false;
// Queue of { resolve, reject } callbacks for requests that arrived while a
// refresh was already in-flight — they all get resumed once refresh completes.
let refreshQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  refreshQueue = [];
};

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
      if (isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          refreshQueue.push({
            resolve: () => resolve(apiClient(originalRequest)),
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post('/auth/refresh');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Refresh failed: the session is over. Tell AuthProvider and let RequireAuth decide
        // where to go. Never redirect here — public pages (landing, terms) must stay put
        // for logged-out visitors.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:expired'));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default apiClient;
