import { setCurrentUser, setSession, hasSession } from './token-storage'

type SessionResponse = {
  session?: { token?: string }
  user?: { id?: string; email?: string; name?: string | null }
}

async function fetchSession(): Promise<SessionResponse | null> {
  const baseUrl = import.meta.env.VITE_API_URL ?? ''
  try {
    const res = await fetch(`${baseUrl}/auth/get-session`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    return (await res.json()) as SessionResponse
  } catch {
    return null
  }
}

export async function syncCurrentUserFromSession(): Promise<void> {
  const user = (await fetchSession())?.user
  if (user?.id) {
    setCurrentUser({
      userId: user.id,
      email: user.email ?? '',
      name: user.name ?? '',
    })
  }
}

export async function bootstrapSessionFromCookie(): Promise<void> {
  if (hasSession()) return

  const data = await fetchSession()
  const token = data?.session?.token
  const user = data?.user
  if (token && user?.id) {
    setSession(token)
    setCurrentUser({
      userId: user.id,
      email: user.email ?? '',
      name: user.name ?? '',
    })
  }
}
