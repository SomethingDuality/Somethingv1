"use client"

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'

type AvatarContextType = {
  avatarUrl: string | null
  setAvatarUrl: (url: string | null) => void
  userName: string
  setUserName: (name: string) => void
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined)

const AVATAR_KEY = 'investor-avatar'
const NAME_KEY = 'investor-name'

// Blocked storage (private mode, site data off) throws: it must not take the app down.
const read = (key: string) => {
  try { return sessionStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string | null) => {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    // Nothing kept for this tab; the profile page reads the server anyway.
  }
}

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, checked } = useAuth()
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null)
  const [userName, setUserNameState] = useState<string>('')

  // Load from memory on mount
  useEffect(() => {
    const stored = read(AVATAR_KEY)
    const storedName = read(NAME_KEY)
    if (stored) setAvatarUrlState(stored)
    if (storedName) setUserNameState(storedName)
  }, [])

  // The photo and name belong to whoever is signed in: signing out (or in as someone else in
  // this tab) clears them, so the next person never sees the last one's.
  const userId = user?.id ?? null
  const owner = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    // Not before /auth/me has answered (a public page may skip it): until then nobody is known.
    if (loading || !checked) return
    if (!userId || (owner.current !== undefined && owner.current !== userId)) {
      setAvatarUrlState(null)
      setUserNameState('')
      write(AVATAR_KEY, null)
      write(NAME_KEY, null)
    }
    owner.current = userId
  }, [loading, checked, userId])

  // Stable, so pages can list them as effect dependencies without re-running on every render.
  const setAvatarUrl = useCallback((url: string | null) => {
    setAvatarUrlState(url)
    write(AVATAR_KEY, url)
  }, [])

  const setUserName = useCallback((name: string) => {
    setUserNameState(name)
    write(NAME_KEY, name)
  }, [])

  const value = useMemo(() => ({ avatarUrl, setAvatarUrl, userName, setUserName }), [avatarUrl, setAvatarUrl, userName, setUserName])

  return (
    <AvatarContext.Provider value={value}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatar() {
  const context = useContext(AvatarContext)
  if (context === undefined) {
    throw new Error('useAvatar must be used within an AvatarProvider')
  }
  return context
}
