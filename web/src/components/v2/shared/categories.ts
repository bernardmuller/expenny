/**
 * Category palette from the v2 ("experiment E") mockups. Categories are
 * tinted at 16% for the surface, 50% for the border and 30% for the chunky
 * bottom lip.
 */
export const categoryColors: Record<string, string> = {
  Groceries: '#5bb5ff',
  'Eating out': '#ff7a6b',
  Fuel: '#a78bfa',
  Shopping: '#f472b6',
  Uncategorised: '#9a9a9a',
  Transfer: '#8e9bb5',
  Subscriptions: '#22d3ee',
  Utilities: '#818cf8',
  Investments: '#2dd4bf',
  Income: '#4cc38a',
}

export const fallbackCategoryColor = '#9a9a9a'

export function withAlpha(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export type CategoryTint = {
  color: string
  background: string
  border: string
  lip: string
}

export function tintFromColor(color?: string): CategoryTint {
  const resolved = color || fallbackCategoryColor

  return {
    color: resolved,
    background: withAlpha(resolved, 0.16),
    border: withAlpha(resolved, 0.5),
    lip: withAlpha(resolved, 0.3),
  }
}

export function categoryTint(label?: string): CategoryTint {
  return tintFromColor(label ? categoryColors[label] : undefined)
}
