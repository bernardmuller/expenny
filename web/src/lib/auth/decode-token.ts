import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { getAccessToken, getStoredCurrentUser } from './token-storage'

interface TokenPayload {
  userId: string
  email: string
  name: string
  iat: number
  exp: number
}

const splitToken = (token: string): Result<Array<string>, string> => {
  const parts = token.split('.')
  return parts.length === 3 ? ok(parts) : err('Invalid token format')
}

const parsePayload = (parts: Array<string>): Result<TokenPayload, string> => {
  try {
    const decoded = JSON.parse(atob(parts[1])) as TokenPayload
    return ok(decoded)
  } catch (error) {
    return err(`Failed to decode token: ${String(error)}`)
  }
}

const validatePayload = (
  payload: TokenPayload,
): Result<TokenPayload, string> => {
  return payload.userId && payload.email && payload.name
    ? ok(payload)
    : err('Invalid token payload: missing required fields')
}

export function decodeJwt(token: string): Result<TokenPayload, string> {
  return splitToken(token).andThen(parsePayload).andThen(validatePayload)
}

const getCurrentUser = (): Result<
  { userId: string; email: string; name: string },
  string
> =>
  getAccessToken().match(
    (token) =>
      decodeJwt(token).match(
        (res) =>
          ok({
            userId: res.userId,
            email: res.email,
            name: res.name,
          }),
        (error) => err(error),
      ),
    () => err('No access token found'),
  )

export const getUserIdFromAccessToken = (): Result<string, string> =>
  getCurrentUser().match(
    (user) => ok(user.userId),
    () => {
      // better-auth mode: the stored token is an opaque session token that
      // cannot be JWT-decoded; fall back to the user captured at login time
      const stored = getStoredCurrentUser()
      return stored ? ok(stored.userId) : err('No user id available')
    },
  )
