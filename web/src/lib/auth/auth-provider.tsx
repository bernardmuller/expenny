import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { hasTokens, clearTokens } from './token-storage'
import { getAuthMode } from './auth-mode'

interface AuthContextValue {
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  checkAuth: () => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasTokens())

  const checkAuth = () => {
    const authenticated = hasTokens()
    setIsAuthenticated(authenticated)
    return authenticated
  }

  const login = () => setIsAuthenticated(true)

  const logout = () => {
    if (getAuthMode() === 'better-auth') {
      void fetch(`${import.meta.env.VITE_API_URL}/auth/sign-out`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {})
    }
    clearTokens()
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
