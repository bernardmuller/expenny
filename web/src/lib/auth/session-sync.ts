import { getAuthMode } from './auth-mode'
import { setCurrentUser, setTokens, hasTokens } from './token-storage'

export async function syncCurrentUserFromSession(): Promise<void> {
  if (getAuthMode() !== 'better-auth') return

  const baseUrl = import.meta.env.VITE_API_URL
  try {
    const res = await fetch(`${baseUrl}/auth/get-session`, {
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as { session?: { token?: string }; user?: { id?: string; email?: string; name?: string | null } }
    const user = data.user
    if (user?.id) {
      setCurrentUser({
        userId: user.id,
        email: user.email ?? '',
        name: user.name ?? '',
      })
    }
  } catch {
    // session sync is best-effort; identity also flows through get-session on API
  }
}

export async function bootstrapSessionFromCookie(): Promise<void> {
  if (getAuthMode() !== 'better-auth') return
  if (hasTokens()) return

  const baseUrl = import.meta.env.VITE_API_URL
  try {
    const res = await fetch(`${baseUrl}/auth/get-session`, {
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      session?: { token?: string }
      user?: { id?: string; email?: string; name?: string | null }
    }
    const token = data.session?.token
    const user = data.user
    if (token && user?.id) {
      // social sign-in only yields a session cookie; surface it to the
      // token-based auth state so route guards behave like the OTP path
      setTokens(token, token)
      setCurrentUser({
        userId: user.id,
        email: user.email ?? '',
        name: user.name ?? '',
      })
    }
  } catch {
    // best-effort; anonymous visitors simply stay on /login
  }
}