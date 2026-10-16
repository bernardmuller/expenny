import type { CategoryOption } from './Review.types'

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

export function categoryTint(label?: string, color?: string): CategoryTint {
  return tintFromColor(color ?? (label ? categoryColors[label] : undefined))
}

export type CategoryOptionGroup = {
  key: string
  label: string
  options: Array<CategoryOption>
}

/**
 * Buckets options by their group, preserving the order the options arrive in
 * (the mapper sorts by group then label). Options without a group land in an
 * "Other" bucket so nothing is ever hidden.
 */
export function groupCategoryOptions(
  options: Array<CategoryOption>,
): Array<CategoryOptionGroup> {
  const groups = new Map<string, CategoryOptionGroup>()

  for (const option of options) {
    const key = option.groupKey ?? 'other'
    let group = groups.get(key)
    if (!group) {
      group = { key, label: option.group ?? 'Other', options: [] }
      groups.set(key, group)
    }
    group.options.push(option)
  }

  return [...groups.values()]
}

const INCOME_GROUPS = new Set(['income', 'transfers', 'other'])
const SPEND_GROUPS = new Set(['expenses', 'recurring', 'transfers', 'other'])

/**
 * Keeps the options a transaction's direction can be tagged with: spending
 * rows see Expenses, Recurring and Transfers, income rows see Income and
 * Transfers. A transfer moves money without being either, so both directions
 * can use it. When every expense and recurring category is also an Income
 * member, an income row can still be categorised as e.g. eating-out for a
 * split bill.
 */
export function filterCategoryOptionsByDirection(
  options: Array<CategoryOption>,
  isIncome: boolean,
): Array<CategoryOption> {
  const allowed = isIncome ? INCOME_GROUPS : SPEND_GROUPS
  return options.filter((option) => allowed.has(option.groupKey ?? 'other'))
}
