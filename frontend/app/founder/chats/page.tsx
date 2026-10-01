"use client"

import { Suspense } from "react"
import { ChatPage } from "@/components/chat/chat-page"

// Chats are the same for founders and investors (community C5).
export default function FounderChatsPage() {
  return (
    <Suspense>
      <ChatPage role="founder" />
    </Suspense>
  )
}
