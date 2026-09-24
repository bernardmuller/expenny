import createClient from 'openapi-fetch'
import type { paths } from './schema'
import { err, ok, ResultAsync } from 'neverthrow'
import {
  getAccessToken,
  clearTokens,
} from '../auth/token-storage'

const baseUrl = import.meta.env.VITE_API_URL ?? ''

export const client = createClient<paths>({
  baseUrl,
  credentials: 'include', // Include session cookie
})

client.use({
  onRequest({ request }) {
    const token = getAccessToken()
    if (!request.headers.get('authorization') && token.isOk()) {
      request.headers.set('authorization', `Bearer ${token.value}`)
    }
    return request
  },
  onResponse({ response }) {
    if (response.status === 401) {
      // Session expired or invalid — clear any stale local state and re-authenticate
      clearTokens()
      window.location.href = '/login'
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
