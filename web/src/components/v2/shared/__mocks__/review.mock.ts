import type { CategoryOption, ReviewItem } from '../Review.types'

export function createReviewItem(
  overrides: Partial<ReviewItem> = {},
): ReviewItem {
  return {
    id: 'review-1',
    merchant: 'Engen 1 Stop',
    emoji: '🛒',
    date: 'Sun 11 Oct 2026',
    amount: 'R 874.00',
    originalDescription: 'POS PURCHASE ENGEN 1STOP N1 CITY',
    category: { id: 'fuel', label: 'Fuel', icon: '⛽' },
    confidence: 76,
    isExpense: true,
    expenseProbability: 93,
    balanceAfter: 'R 31 689.40',
    ...overrides,
  }
}

export const mockReviewItems: Array<ReviewItem> = [
  createReviewItem(),
  createReviewItem({
    id: 'review-2',
    merchant: 'Takealot',
    emoji: '📦',
    date: 'Sat 10 Oct 2026',
    amount: 'R 899.00',
    originalDescription: 'TAKEALOT.COM ORDER 77402918',
    category: { id: 'shopping', label: 'Shopping', icon: '🛍️' },
    confidence: 62,
    balanceAfter: 'R 32 563.40',
  }),
  createReviewItem({
    id: 'review-3',
    merchant: 'PayShap payment',
    emoji: '❓',
    date: 'Fri 10 Oct 2026',
    amount: 'R 450.00',
    originalDescription: 'PAYSHAP PAYMENT',
    category: { id: 'uncategorised', label: 'Uncategorised', icon: '❓' },
    confidence: 41,
    balanceAfter: 'R 33 462.40',
  }),
]

export const mockCategoryOptions: Array<CategoryOption> = [
  { label: '⛽ Fuel', value: 'fuel' },
  { label: '🛍️ Shopping', value: 'shopping' },
  { label: '🥡 Eating out', value: 'eating-out' },
  { label: '🛒 Groceries', value: 'groceries' },
  { label: '❓ Uncategorised', value: 'uncategorised' },
]
