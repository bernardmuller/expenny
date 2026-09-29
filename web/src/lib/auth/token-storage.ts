import * as dataStore from '../storage/data-store'
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../storage/storage-keys'
import type { StoredCurrentUser } from '../storage/storage-keys'

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
  dataStore.removeItem(STORAGE_KEYS.QUERY_CACHE)
  dataStore.removeLegacyItems(LEGACY_STORAGE_KEYS)
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_OAUTH)
}

export const hasSession = () => getSessionToken() !== undefined
