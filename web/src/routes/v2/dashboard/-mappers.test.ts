import { describe, expect, it } from 'vitest'

import {
  buildTransactionFilters,
  filterTransactions,
  formatRand,
  toCategoryOptions,
  toReviewItem,
  toStatementTransaction,
} from './-mappers'
import type { StatementTransaction } from '@/lib/http/v2/types'

function transaction(
  overrides: Partial<StatementTransaction> = {},
): StatementTransaction {
  return {
    id: 'txn-1',
    nr: 1,
    account: 'Capitec',
    posting_date: '2026-10-11T00:00:00Z',
    transaction_date: '2026-10-11T14:32:00Z',
    description: 'POS PURCHASE ENGEN 1STOP N1 CITY',
    original_description: 'ENGEN 1STOP',
    parent_category: null,
    category: null,
    money_in: '0.00',
    money_out: '874.00',
    fee: '0.00',
    balance: '31689.40',
    classification: {
      id: 'classification-1',
      category: {
        id: 'fuel',
        key: 'transport-fuel',
        label: 'Transport & Fuel',
        icon: '🚗',
      },
      is_expense: true,
      expense_prob: 0.93,
      confidence: 0.76,
      source: 'provider',
      classified_at: '2026-10-11T15:00:00Z',
    },
    needs_review: true,
    ...overrides,
  }
}

describe('formatRand', () => {
  it('formats two decimals with a dot', () => {
    expect(formatRand(874)).toBe('R 874.00')
    expect(formatRand(0)).toBe('R 0.00')
  })

  it('groups thousands', () => {
    expect(formatRand(1234.5).replace(/\u00a0/g, ' ')).toBe('R 1 234.50')
  })
})

describe('toStatementTransaction', () => {
  it('maps a classified expense row for the table', () => {
    const row = toStatementTransaction(transaction())

    expect(row.amount).toBe('R 874.00')
    expect(row.balance?.replace(/\u00a0/g, ' ')).toBe('R 31 689.40')
    expect(row.confidence).toBe(76)
    expect(row.needsReview).toBe(true)
    expect(row.direction).toBe('out')
    expect(row.category).toEqual({
      id: 'fuel',
      label: 'Transport & Fuel',
      icon: '🚗',
    })
  })

  it('prefixes income with a plus and does not count it against the budget', () => {
    const row = toStatementTransaction(
      transaction({
        id: 'txn-2',
        money_in: '38500.00',
        money_out: '0.00',
        classification: {
          id: 'classification-2',
          category: {
            id: 'income',
            key: 'income',
            label: 'Income',
            icon: '💼',
          },
          is_expense: false,
          expense_prob: 0,
          confidence: 1,
          source: 'rule',
          classified_at: '2026-10-01T00:00:00Z',
        },
        needs_review: false,
      }),
    )

    expect(row.amount.replace(/\u00a0/g, ' ')).toBe('+R 38 500.00')
    expect(row.direction).toBe('in')
    expect(row.counted).toBeUndefined()
  })

  it('marks an outgoing non-expense as not counted', () => {
    const row = toStatementTransaction(
      transaction({
        classification: {
          id: 'classification-3',
          category: {
            id: 'transfer',
            key: 'transfer',
            label: 'Transfer',
            icon: '🔄',
          },
          is_expense: false,
          expense_prob: 0.2,
          confidence: 0.83,
          source: 'provider',
          classified_at: '2026-10-07T00:00:00Z',
        },
        needs_review: false,
      }),
    )

    expect(row.counted).toBe(false)
  })

  it('shows the absolute money_out for an expense stored as a negative amount', () => {
    const row = toStatementTransaction(transaction({ money_out: '-238.00' }))

    expect(row.amount).toBe('R 238.00')
    expect(row.balance).toBeDefined()
    expect(row.direction).toBe('out')
  })

  it('falls back to uncategorised when a row has no classification', () => {
    const row = toStatementTransaction(
      transaction({ classification: null, needs_review: true }),
    )

    expect(row.category.id).toBe('uncategorised')
    expect(row.confidence).toBeUndefined()
    expect(row.needsReview).toBe(true)
  })
})

describe('toReviewItem', () => {
  it('maps confidence and expense probability to percentages', () => {
    const item = toReviewItem(transaction())

    expect(item.confidence).toBe(76)
    expect(item.expenseProbability).toBe(93)
    expect(item.merchant).toBe('POS PURCHASE ENGEN 1STOP N1 CITY')
    expect(item.isExpense).toBe(true)
  })
})

describe('toCategoryOptions', () => {
  it('sorts by category name, not by the emoji prefix', () => {
    const options = toCategoryOptions([
      { id: 'fuel', key: 'fuel', label: 'Fuel', icon: '⛽' },
      { id: 'groceries', key: 'groceries', label: 'Groceries', icon: '🛒' },
      { id: 'eating-out', key: 'eating-out', label: 'Eating out', icon: '🍔' },
    ])

    expect(options).toEqual([
      { label: '🍔 Eating out', value: 'eating-out' },
      { label: '⛽ Fuel', value: 'fuel' },
      { label: '🛒 Groceries', value: 'groceries' },
    ])
  })
})

describe('filterTransactions', () => {
  const rows = [
    toStatementTransaction(transaction()),
    toStatementTransaction(
      transaction({
        id: 'txn-2',
        description: 'SALARY CREDIT',
        money_in: '38500.00',
        money_out: '0.00',
        classification: null,
        needs_review: false,
      }),
    ),
  ]

  it('filters to rows needing review', () => {
    expect(filterTransactions(rows, 'review', '')).toHaveLength(1)
    expect(filterTransactions(rows, 'all', '')).toHaveLength(2)
  })

  it('filters to money in', () => {
    const moneyIn = filterTransactions(rows, 'money-in', '')
    expect(moneyIn).toHaveLength(1)
    expect(moneyIn[0].description).toBe('SALARY CREDIT')
  })

  it('searches the description case-insensitively', () => {
    expect(filterTransactions(rows, 'all', 'salary')).toHaveLength(1)
    expect(filterTransactions(rows, 'all', 'nope')).toHaveLength(0)
  })

  it('counts all and review rows', () => {
    const filters = buildTransactionFilters(rows)
    expect(filters[0]).toEqual({ id: 'all', label: 'All', count: 2 })
    expect(filters[1]).toEqual({
      id: 'review',
      label: 'Needs review',
      count: 1,
    })
  })
})
