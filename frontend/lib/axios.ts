// The API client: a small fetch wrapper with axios's surface (the app used axios, 18 KB gzipped on
// every page, for this). Calls look the same: apiClient.get<T>(url, { params, headers }) and
// post/put/patch(url, data, config) resolve { data, status, headers }; anything but a 2xx rejects
// with an ApiError carrying `response.{status,data}`, and an unreachable server rejects with
// `code: "ERR_NETWORK"` and no response.

// 5050, not 5000: macOS AirPlay Receiver already listens on 5000.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5050';

// Like axios, a response body is `any` unless the call names its type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type RequestConfig = {
  /** Sent as the query string; undefined and null values are left out. */
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** The body of a DELETE (axios's `config.data`). */
  data?: unknown;
  /** Every call sends the sign-in cookies; `false` keeps them for same-origin only. */
  withCredentials?: boolean;
  signal?: AbortSignal;
};

export type ApiRequest = RequestConfig & { method: Method; url: string; _retry?: boolean };

export type ApiResponse<T = Any> = { data: T; status: number; headers: Record<string, string> };

/** A failed call, shaped like axios's error so `err.response?.status` checks keep working. */
export class ApiError extends Error {
  response?: ApiResponse;
  config: ApiRequest;
  code?: string;

  constructor(message: string, config: ApiRequest, { response, code }: { response?: ApiResponse; code?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.config = config;
    this.response = response;
    this.code = code;
  }
}

/** The query string axios would send for `params` (arrays as key[]=a&key[]=b, dates as ISO). */
export function encodeParams(params?: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
      q.append(Array.isArray(value) ? `${key}[]` : key, s);
    }
  }
  return q.toString();
}

/** API_BASE_URL + url (absolute URLs pass through), with the params appended. */
export function buildUrl(url: string, params?: Record<string, unknown>): string {
  const full = /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url) ? url : `${API_BASE_URL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  const qs = encodeParams(params);
  return qs ? `${full}${full.includes('?') ? '&' : '?'}${qs}` : full;
}

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

type MutationListener = (method: Method, url: string) => void;
const mutationListeners = new Set<MutationListener>();

/** Runs after every successful POST/PUT/PATCH/DELETE (lib/api-cache drops what it changed). */
export function onMutation(listener: MutationListener): () => void {
  mutationListeners.add(listener);
  return () => { mutationListeners.delete(listener); };
}

async function send<T>(req: ApiRequest): Promise<ApiResponse<T>> {
  const headers = new Headers({ Accept: 'application/json, text/plain, */*' });
  for (const [k, v] of Object.entries(req.headers ?? {})) headers.set(k, v);

  let body: BodyInit | undefined;
  const data = req.method === 'get' ? undefined : req.data;
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    // The browser writes the multipart Content-Type itself, with the boundary; a caller's
    // "multipart/form-data" without one would break the upload.
    headers.delete('Content-Type');
    body = data;
  } else if (typeof data === 'string' || data instanceof URLSearchParams || data instanceof Blob || data instanceof ArrayBuffer) {
    body = data;
  } else if (data !== undefined && data !== null) {
    body = JSON.stringify(data);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(req.url, req.params), {
      method: req.method.toUpperCase(),
      headers,
      body,
      credentials: req.withCredentials === false ? 'same-origin' : 'include',
      signal: req.signal,
    });
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    throw new ApiError(aborted ? 'canceled' : 'Network Error', req, { code: aborted ? 'ERR_CANCELED' : 'ERR_NETWORK' });
  }

  // JSON when it parses (whatever the Content-Type says), else the text; an empty body is "".
  const text = await res.text();
  let parsed: unknown = text;
  if (text) {
    try { parsed = JSON.parse(text); } catch { /* not JSON: keep the text */ }
  }
  const resHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { resHeaders[k] = v; });
  const response: ApiResponse<T> = { data: parsed as T, status: res.status, headers: resHeaders };

  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(`Request failed with status code ${res.status}`, req, {
      response,
      code: res.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    });
  }
  return response;
}

async function request<T = Any>(req: ApiRequest): Promise<ApiResponse<T>> {
  try {
    const res = await send<T>(req);
    if (req.method !== 'get') {
      const path = req.url.split('?')[0];
      mutationListeners.forEach((fn) => fn(req.method, path));
    }
    return res;
  } catch (err) {
    const status = (err as ApiError).response?.status;
    // Only refresh on 401, never on 429 or other errors; never for a retry, or for the refresh itself.
    if (
      status === 401 &&
      !req._retry &&
      !req.url.includes('/auth/refresh') &&
      // Don't attempt refresh while on auth pages — avoids reload loops
      (typeof window === 'undefined' || (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')))
    ) {
      // Requests that 401 together wait for the same refresh, then go again.
      await refreshSession();
      return request<T>({ ...req, _retry: true });
    }
    throw err;
  }
}

const apiClient = {
  request,
  get: <T = Any>(url: string, config: RequestConfig = {}) => request<T>({ ...config, method: 'get', url }),
  delete: <T = Any>(url: string, config: RequestConfig = {}) => request<T>({ ...config, method: 'delete', url }),
  post: <T = Any>(url: string, data?: unknown, config: RequestConfig = {}) => request<T>({ ...config, method: 'post', url, data }),
  put: <T = Any>(url: string, data?: unknown, config: RequestConfig = {}) => request<T>({ ...config, method: 'put', url, data }),
  patch: <T = Any>(url: string, data?: unknown, config: RequestConfig = {}) => request<T>({ ...config, method: 'patch', url, data }),
};

export default apiClient;
