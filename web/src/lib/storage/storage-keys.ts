export const STORAGE_KEYS = {
  /** better-auth session token, mirrored from the session cookie */
  SESSION_TOKEN: 'sessionToken',
  CURRENT_USER: 'currentUser',
  BUDGET_PRIVACY: 'budgetPrivacy',
  THEME: 'vite-ui-theme',
  QUERY_CACHE: 'expense-tracker-query-cache',
  STREAK: 'streakLastLogged',
  /** Stored in sessionStorage: URL to resume after MCP OAuth authorize flow */
  PENDING_OAUTH: 'pendingOAuth',
} as const

/**
 * Keys written by older builds that nothing reads any more. Pruned on sign-out
 * so an existing install stops carrying them around.
 */
export const LEGACY_STORAGE_KEYS = ['accessToken', 'refreshToken'] as const

export interface StoredCurrentUser {
  userId: string
  email: string
  name: string
}

type StorageSchema = {
  [STORAGE_KEYS.SESSION_TOKEN]: string
  [STORAGE_KEYS.CURRENT_USER]: StoredCurrentUser
  [STORAGE_KEYS.BUDGET_PRIVACY]: string // stored as 'true' | 'false'
  [STORAGE_KEYS.THEME]: 'light' | 'dark' | 'system'
  [STORAGE_KEYS.QUERY_CACHE]: any // TanStack Query cache structure
  [STORAGE_KEYS.STREAK]: string
}

export type StorageKey = keyof StorageSchema
export type StorageValue<K extends StorageKey> = StorageSchema[K]
