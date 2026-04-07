'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Client, Account, ID, Models, OAuthProvider } from 'appwrite'

// Singleton pattern to ensure client is properly initialized
let client: Client | null = null
let account: Account | null = null

function getClient(): Client | null {
  if (!client) {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
    
    if (!endpoint || !projectId) {
      return null
    }
    
    client = new Client()
    client.setEndpoint(endpoint)
    client.setProject(projectId)
  }
  return client
}

function getAccount(): Account | null {
  const c = getClient()
  if (!c) return null
  if (!account) {
    account = new Account(c)
  }
  return account
}

interface AuthContextType {
  user: Models.User<Models.Preferences> | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => void
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper to set user ID cookie (for API routes to identify the user)
function setUserCookie(user: Models.User<Models.Preferences> | null) {
  if (user) {
    // Set cookie with 30 day expiry
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    document.cookie = `appwrite-user-id=${user.$id}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
    document.cookie = `appwrite-user-email=${encodeURIComponent(user.email)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
  } else {
    // Clear cookies
    document.cookie = 'appwrite-user-id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'appwrite-user-email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const acc = getAccount()
      if (!acc) {
        setUser(null)
        setUserCookie(null)
        setIsLoading(false)
        return
      }
      const currentUser = await acc.get()
      setUser(currentUser)
      setUserCookie(currentUser)
    } catch {
      setUser(null)
      setUserCookie(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const acc = getAccount()
    if (!acc) throw new Error('Appwrite not configured')
    await acc.createEmailPasswordSession(email, password)
    const currentUser = await acc.get()
    setUser(currentUser)
    setUserCookie(currentUser)
  }

  const loginWithGoogle = () => {
    const acc = getAccount()
    if (!acc) {
      console.error('Appwrite not configured - missing NEXT_PUBLIC_APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_PROJECT_ID')
      return
    }
    const successUrl = `${window.location.origin}/`
    const failureUrl = `${window.location.origin}/login`
    acc.createOAuth2Session(OAuthProvider.Google, successUrl, failureUrl)
  }

  const register = async (email: string, password: string, name: string) => {
    const acc = getAccount()
    if (!acc) throw new Error('Appwrite not configured')
    await acc.create(ID.unique(), email, password, name)
    await login(email, password)
  }

  const logout = async () => {
    const acc = getAccount()
    if (!acc) return
    await acc.deleteSession('current')
    setUserCookie(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
