export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  CURRENT_USER: 'currentUser',
  BUDGET_PRIVACY: 'budgetPrivacy',
  THEME: 'vite-ui-theme',
  QUERY_CACHE: 'expense-tracker-query-cache',
  STREAK: 'streakLastLogged',
} as const

export interface StoredCurrentUser {
  userId: string
  email: string
  name: string
}

type StorageSchema = {
  [STORAGE_KEYS.ACCESS_TOKEN]: string
  [STORAGE_KEYS.REFRESH_TOKEN]: string
  [STORAGE_KEYS.CURRENT_USER]: StoredCurrentUser
  [STORAGE_KEYS.BUDGET_PRIVACY]: string // stored as 'true' | 'false'
  [STORAGE_KEYS.THEME]: 'light' | 'dark' | 'system'
  [STORAGE_KEYS.QUERY_CACHE]: any // TanStack Query cache structure
  [STORAGE_KEYS.STREAK]: string
}

export type StorageKey = keyof StorageSchema
export type StorageValue<K extends StorageKey> = StorageSchema[K]
