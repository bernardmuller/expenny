import { STORAGE_KEYS } from '@/lib/storage/storage-keys'

export const PENDING_OAUTH_KEY = STORAGE_KEYS.PENDING_OAUTH

export function hasAuthorizeParams(params: URLSearchParams): boolean {
  return (
    params.has('client_id') ||
    params.has('redirect_uri') ||
    params.has('code_challenge')
  )
}

export function capturePendingOAuth(search: string): string | null {
  const params = new URLSearchParams(search)
  if (hasAuthorizeParams(params)) {
    params.delete('resume')
    const apiUrl = import.meta.env.VITE_API_URL ?? ''
    const resumeUrl = `${apiUrl}/auth/mcp/authorize?${params.toString()}`
    sessionStorage.setItem(PENDING_OAUTH_KEY, resumeUrl)
    return resumeUrl
  }
  return sessionStorage.getItem(PENDING_OAUTH_KEY)
}

export function consumePendingOAuth(): string | null {
  const url = sessionStorage.getItem(PENDING_OAUTH_KEY)
  if (url) sessionStorage.removeItem(PENDING_OAUTH_KEY)
  return url
}

export async function startGoogleSignIn(): Promise<boolean> {
  capturePendingOAuth(window.location.search)
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? ''}/auth/sign-in/social`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'google',
          callbackURL: `${window.location.origin}/login?resume=1`,
          errorCallbackURL: `${window.location.origin}/login`,
        }),
      },
    )
    const data = (await res.json()) as { url?: string } | undefined
    if (res.ok && data?.url) {
      window.location.href = data.url
      return true
    }
  } catch {
  }
  return false
}
