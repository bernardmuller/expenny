import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { hasSession, clearSession } from './token-storage'

interface AuthContextValue {
  isAuthenticated: boolean
  login: () => void
  logout: () => Promise<void>
  checkAuth: () => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasSession())

  const checkAuth = () => {
    const authenticated = hasSession()
    setIsAuthenticated(authenticated)
    return authenticated
  }

  const login = () => setIsAuthenticated(true)

  const logout = async () => {
    try {
      // Awaited, not fire-and-forget: navigating away cancels the request before
      // the browser applies the Set-Cookie that clears the session, leaving a
      // live cookie that bootstrapSessionFromCookie turns straight back into
      // tokens on /login — signing the user back in.
      await fetch(`${import.meta.env.VITE_API_URL ?? ''}/auth/sign-out`, {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // API down or offline — still drop local state so sign-out is honoured here.
    }
    clearSession()
    setIsAuthenticated(false)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
