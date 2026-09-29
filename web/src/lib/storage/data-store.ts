import type { StorageKey, StorageValue } from './storage-keys'

const STORE_KEY = 'EXPENSE-TRACKER'

const parseStorage = (storage: string | null): Record<string, any> => {
  try {
    return storage ? JSON.parse(storage) : {}
  } catch {
    return {}
  }
}

export const setItem = <K extends StorageKey>(
  key: K,
  value: StorageValue<K>,
): void => {
  const storage = parseStorage(localStorage.getItem(STORE_KEY))
  storage[key] = value
  localStorage.setItem(STORE_KEY, JSON.stringify(storage))
}

export const getItem = <K extends StorageKey>(
  key: K,
): StorageValue<K> | undefined => {
  const localData = parseStorage(localStorage.getItem(STORE_KEY))
  return localData[key]
}

export const removeItem = (key: StorageKey): void => {
  const storage = parseStorage(localStorage.getItem(STORE_KEY))
  delete storage[key]
  localStorage.setItem(STORE_KEY, JSON.stringify(storage))
}

export const removeLegacyItems = (keys: ReadonlyArray<string>): void => {
  const storage = parseStorage(localStorage.getItem(STORE_KEY))
  for (const key of keys) delete storage[key]
  localStorage.setItem(STORE_KEY, JSON.stringify(storage))
}

const clearAll = (): void => {
  localStorage.removeItem(STORE_KEY)
}
