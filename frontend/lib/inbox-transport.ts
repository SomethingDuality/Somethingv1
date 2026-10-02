// Every chat and inbox call goes through here (community C5). Today it is polling; a push
// channel (SSE) can replace it later in this one file.
import apiClient from "@/lib/axios"

export type ThreadStatus = "request_in" | "request_out" | "active" | "closed"

export type Thread = {
  id: string
  kind: "founder_investor" | "founder_founder"
  status: ThreadStatus
  /** The other person as you may see them: a ghost investor has no name, only a stage hint. */
  other: { name: string; role: "Founder" | "Investor" | null; ghost: boolean; hint?: string; firm?: string }
  context: { ideaId: string | null; ideaTitle: string }
  lastMessage: { text: string; at: string; mine: boolean } | null
  unread: number
  /** Your side: whether you are a ghost here and can still share your name. */
  me: { ghost: boolean; canReveal: boolean }
  /** A founder in a co-founder chat about their own idea can invite the other person (C6). */
  canInvite?: boolean
  canSend: boolean
  /** Why you can't send right now (shown in place of the composer). */
  reason: string | null
  updatedAt: string
}

export type Message = {
  id: string
  kind: "text" | "event"
  text: string
  at: string
  mine: boolean
  clientId?: string
}

export type InboxSummary = {
  serverTime: string
  notifications: { unread: number }
  chats: { unreadThreads: number; unreadMessages: number; incomingRequests: number; lastActivityAt: string | null }
}

export type Notification = {
  id: string
  text: string
  timestamp: string
  read: boolean
  /** The page it opens, e.g. the idea it is about. */
  link?: string | null
}

export const inbox = {
  summary: () => apiClient.get<InboxSummary>("/inbox/summary").then((r) => r.data),
  notifications: () => apiClient.get<Notification[]>("/notifications").then((r) => r.data),
  markNotificationRead: (id: string) => apiClient.post(`/notifications/mark-read/${id}`, {}),
  markAllNotificationsRead: () => apiClient.post("/notifications/mark-all-read", {}),
  clearNotifications: () => apiClient.delete("/notifications"),
  threads: () => apiClient.get<{ threads: Thread[]; lastActivityAt: string | null }>("/threads").then((r) => r.data),
  thread: (id: string) => apiClient.get<Thread>(`/threads/${id}`).then((r) => r.data),
  messages: (id: string, after?: string) =>
    apiClient.get<Message[]>(`/threads/${id}/messages`, { params: after ? { after } : {} }).then((r) => r.data),
  start: (ideaId: string, text: string, clientId: string) =>
    apiClient.post<{ thread: Thread; existing: boolean }>("/threads", { ideaId, text, clientId }).then((r) => r.data),
  send: (id: string, text: string, clientId: string) =>
    apiClient.post<{ message: Message; thread: Thread }>(`/threads/${id}/messages`, { text, clientId }).then((r) => r.data),
  accept: (id: string) => apiClient.post<Thread>(`/threads/${id}/accept`, {}).then((r) => r.data),
  decline: (id: string) => apiClient.post<Thread>(`/threads/${id}/decline`, {}).then((r) => r.data),
  read: (id: string) => apiClient.post(`/threads/${id}/read`, {}),
  reveal: (id: string) => apiClient.post<Thread>(`/threads/${id}/reveal`, { confirm: true }).then((r) => r.data),
  block: (id: string) => apiClient.post<Thread>(`/threads/${id}/block`, {}).then((r) => r.data),
}

/** A fresh id for one send, so a retry of the same send lands once. */
export const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
