"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

type AvatarContextType = {
  avatarUrl: string | null
  setAvatarUrl: (url: string | null) => void
  userName: string
  setUserName: (name: string) => void
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined)

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null)
  const [userName, setUserNameState] = useState<string>('')

  // Load from memory on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('investor-avatar')
    const storedName = sessionStorage.getItem('investor-name')
    if (stored) setAvatarUrlState(stored)
    if (storedName) setUserNameState(storedName)
  }, [])

  const setAvatarUrl = (url: string | null) => {
    setAvatarUrlState(url)
    if (url) {
      sessionStorage.setItem('investor-avatar', url)
    } else {
      sessionStorage.removeItem('investor-avatar')
    }
  }

  const setUserName = (name: string) => {
    setUserNameState(name)
    sessionStorage.setItem('investor-name', name)
  }

  return (
    <AvatarContext.Provider value={{ avatarUrl, setAvatarUrl, userName, setUserName }}>
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