import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { getStoredCurrentUser } from './token-storage'

export const getUserIdFromAccessToken = (): Result<string, string> => {
  const stored = getStoredCurrentUser()
  return stored ? ok(stored.userId) : err('No user id available')
}
