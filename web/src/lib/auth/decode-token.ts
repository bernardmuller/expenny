import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { getStoredCurrentUser } from './token-storage'

/**
 * Returns the userId from the stored current-user snapshot set at login time.
 * Tokens are opaque (better-auth sessions); JWT decoding is not available.
 *
 * Signature is unchanged so all ~10 call sites need no edits.
 */
export const getUserIdFromAccessToken = (): Result<string, string> => {
  const stored = getStoredCurrentUser()
  return stored ? ok(stored.userId) : err('No user id available')
}
