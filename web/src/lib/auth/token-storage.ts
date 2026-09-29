import * as dataStore from '../storage/data-store'
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../storage/storage-keys'
import type { StoredCurrentUser } from '../storage/storage-keys'

/**
 * A mirror of the better-auth session token, which is also held in the
 * `expenny.session_token` cookie.
 *
 * The cookie is what authenticates a request — the API reads it via
 * `getSession()`, and there is no bearer plugin that would accept the token in
 * a header. This copy exists so route guards and the auth provider can answer
 * "is someone signed in?" synchronously, before any network call.
 */
export function getSessionToken(): string | undefined {
  return dataStore.getItem(STORAGE_KEYS.SESSION_TOKEN)
}

export function setSession(token: string): void {
  dataStore.setItem(STORAGE_KEYS.SESSION_TOKEN, token)
}

export function setCurrentUser(user: StoredCurrentUser): void {
  dataStore.setItem(STORAGE_KEYS.CURRENT_USER, user)
}

export function getStoredCurrentUser(): StoredCurrentUser | undefined {
  return dataStore.getItem(STORAGE_KEYS.CURRENT_USER)
}

export function clearSession(): void {
  dataStore.removeItem(STORAGE_KEYS.SESSION_TOKEN)
  dataStore.removeItem(STORAGE_KEYS.CURRENT_USER)
  // The persisted TanStack Query cache holds the signed-out user's categories
  // and budgets; leaving it behind leaks them into the next session.
  dataStore.removeItem(STORAGE_KEYS.QUERY_CACHE)
  dataStore.removeLegacyItems(LEGACY_STORAGE_KEYS)
  // A resume URL left over from an abandoned MCP authorize would hijack the
  // next sign-in.
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_OAUTH)
}

export const hasSession = () => getSessionToken() !== undefined
