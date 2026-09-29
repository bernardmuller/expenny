let googleConfigured = false

export function getGoogleConfigured(): boolean {
  return googleConfigured
}

export async function initAuthMode(): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_URL ?? ''
  try {
    const res = await fetch(`${baseUrl}/auth/mode`, { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as { google?: boolean }
      googleConfigured = Boolean(data.google)
    }
  } catch {
  }
}
