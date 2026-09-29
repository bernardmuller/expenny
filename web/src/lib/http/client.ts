import createClient from 'openapi-fetch'
import type { paths } from './schema'
import { err, ok, ResultAsync } from 'neverthrow'
import { clearSession } from '../auth/token-storage'

const baseUrl = import.meta.env.VITE_API_URL ?? ''

// The session cookie is the credential — the API authenticates browser
// requests with `getSession()`, which reads it. Endpoints that take a token in
// a header (the OTP verify pair) pass it explicitly.
export const client = createClient<paths>({
  baseUrl,
  credentials: 'include',
})

client.use({
  onResponse({ response }) {
    if (response.status === 401) {
      // Session expired or invalid — clear any stale local state and re-authenticate
      clearSession()
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
