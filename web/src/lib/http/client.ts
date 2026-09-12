import createClient from 'openapi-fetch'
import type { paths } from './schema'
import { err, ok, ResultAsync } from 'neverthrow'
import { getAuthMode } from '../auth/auth-mode'
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from '../auth/token-storage'

const baseUrl = import.meta.env.VITE_API_URL

if (!baseUrl) {
  throw new Error('VITE_API_URL environment variable is not set')
}

export const client = createClient<paths>({
  baseUrl,
  credentials: 'include', // Include cookies for auth
})

let refreshPromise: Promise<{
  accessToken: string
  refreshToken: string
} | null> | null = null

const refreshTokens = (): Promise<{
  accessToken: string
  refreshToken: string
} | null> =>
  getRefreshToken()
    .asyncAndThen((refreshToken) =>
      toResult(
        client.POST('/auth/refresh', {
          params: {
            header: {
              authorization: `Bearer ${refreshToken}`,
            },
          },
        }),
      ),
    )
    .map((data) => {
      setTokens(data.accessToken, data.refreshToken)
      return data
    })
    .match(
      (data) => data,
      () => {
        clearTokens()
        window.location.href = '/login'
        return null
      },
    )

client.use({
  onRequest({ request }) {
    const token = getAccessToken()
    if (!request.headers.get('authorization')) {
      request.headers.set('authorization', `Bearer ${token}`)
    }
    return request
  },
  async onResponse({ request, response }) {
    if (response.status === 401 && !request.url.includes('/auth/refresh')) {
      if (getAuthMode() === 'better-auth') {
        // sessions don't refresh like JWTs; drop local state and re-authenticate
        clearTokens()
        window.location.href = '/login'
        return response
      }
      if (!refreshPromise) {
        refreshPromise = refreshTokens().finally(() => {
          refreshPromise = null
        })
      }
      const newTokens = await refreshPromise
      if (!newTokens) return response
      const newRequest = request.clone()
      newRequest.headers.set('authorization', `Bearer ${newTokens.accessToken}`)
      return fetch(newRequest)
    }

    return response
  },
})

type ApiResponse<T> = T extends { data: infer D } ? D : never
type ApiError<T> = T extends { error: infer E } ? E : never

export function toResult<T, E>(
  promise: Promise<{ data?: T; error?: E; response: Response }>,
): ResultAsync<T, E> {
  return ResultAsync.fromPromise(promise, (e) => e as E).andThen(
    ({ data, error }) => {
      if (error) return err(error)
      if (data !== undefined) return ok(data)
      return err(error as E)
    },
  )
}
