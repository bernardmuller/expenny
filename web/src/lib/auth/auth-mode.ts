export type AuthMode = 'legacy' | 'better-auth'

let cachedMode: AuthMode | null = null
let googleConfigured = false

export function getAuthMode(): AuthMode {
  return cachedMode ?? 'legacy'
}

export function getGoogleConfigured(): boolean {
  return googleConfigured
}

export async function initAuthMode(): Promise<void> {
  if (cachedMode) return

  const baseUrl = import.meta.env.VITE_API_URL
  try {
    const res = await fetch(`${baseUrl}/auth/mode`, { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as { mode?: string; google?: boolean }
      cachedMode = data.mode === 'better-auth' ? 'better-auth' : 'legacy'
      googleConfigured = Boolean(data.google)
      return
    }
  } catch {
    // fall through to legacy default
  }
  cachedMode = 'legacy'
}