import { clearSession } from '@/lib/auth/token-storage'

const baseUrl = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown>
}

/**
 * Thin wrapper around fetch for the Go v2 API. The session travels in the
 * better-auth cookie, so every request is credentialed. A 401 clears the
 * local session and bounces to the login page, the same way the v1 client
 * behaves.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options
  const isFormData = body instanceof FormData

  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && !isFormData
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers,
    },
    ...(body !== undefined
      ? { body: isFormData ? body : JSON.stringify(body) }
      : {}),
  })

  if (response.status === 401) {
    clearSession()
    window.location.href = '/login'
    throw new ApiError(401, 'You are not signed in')
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) message = payload.error
    } catch {
      // The body was not JSON; the generic message is the best we have.
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
