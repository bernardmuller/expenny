import createClient from 'openapi-fetch'
import type { paths } from './schema'
import { err, ok, ResultAsync } from 'neverthrow'
import { clearSession } from '../auth/token-storage'

const baseUrl = import.meta.env.VITE_API_URL ?? ''

export const client = createClient<paths>({
  baseUrl,
  credentials: 'include',
})

client.use({
  onResponse({ response }) {
    if (response.status === 401) {
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
    ({ data, error, response }) => {
      if (error) return err(error)
      if (data !== undefined) return ok(data)
      // Neither parsed body nor error (e.g. an empty or non-JSON response).
      // Returning err(undefined) here makes every `error.message` downstream
      // throw, which swallows the failure silently.
      return err({
        error: 'UnexpectedResponse',
        message: `Unexpected empty response (${response.status})`,
        code: 'UNEXPECTED_RESPONSE',
      } as E)
    },
  )
}
