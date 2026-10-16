import { describe, expect, it } from 'vitest'

import {
  buildTransactionFilters,
  filterTransactions,
  formatBudgetMonth,
  formatBudgetWindow,
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
      group: 'expenses',
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
      group: 'expenses',
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
          group: 'income',
          classified_at: '2026-10-01T00:00:00Z',
        },
        needs_review: false,
      }),
    )

    expect(row.amount.replace(/\u00a0/g, ' ')).toBe('+R 38 500.00')
    expect(row.direction).toBe('in')
    expect(row.isFee).toBe(false)
  })

  it('marks a row carrying a fee as a bank fee', () => {
    const row = toStatementTransaction(
      transaction({ fee: '25.00', money_out: '0.00' }),
    )

    expect(row.isFee).toBe(true)
  })

  it('marks a row classified as bank fees as a fee', () => {
    const row = toStatementTransaction(
      transaction({
        fee: '0.00',
        classification: {
          id: 'classification-fee',
          category: {
            id: 'bank-fees',
            key: 'bank-fees',
            label: 'Bank Fees',
            icon: '🏦',
          },
          is_expense: false,
          expense_prob: 0,
          confidence: 1,
          source: 'rule',
          group: 'expenses',
          classified_at: '2026-10-07T00:00:00Z',
        },
        needs_review: false,
      }),
    )

    expect(row.isFee).toBe(true)
  })

  it('shows the absolute money_out for an expense stored as a negative amount', () => {
    const row = toStatementTransaction(transaction({ money_out: '-238.00' }))

    expect(row.amount).toBe('R 238.00')
    expect(row.balance).toBeDefined()
    expect(row.direction).toBe('out')
  })

  it('derives direction from the amounts, not the classifier', () => {
    const base = transaction()

    const income = toStatementTransaction(
      transaction({
        money_in: '1200.00',
        money_out: '0.00',
        classification: base.classification
          ? { ...base.classification, is_expense: true }
          : null,
      }),
    )
    expect(income.direction).toBe('in')

    const expense = toStatementTransaction(
      transaction({
        money_in: '0.00',
        money_out: '520.00',
        classification: base.classification
          ? { ...base.classification, is_expense: false }
          : null,
      }),
    )
    expect(expense.direction).toBe('out')
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
  it('maps confidence to a percentage', () => {
    const item = toReviewItem(transaction())

    expect(item.confidence).toBe(76)
    expect(item.merchant).toBe('POS PURCHASE ENGEN 1STOP N1 CITY')
  })
})

describe('toCategoryOptions', () => {
  it('expands memberships and sorts by group then category name', () => {
    const options = toCategoryOptions([
      {
        id: 'fuel',
        key: 'fuel',
        label: 'Fuel',
        icon: '⛽',
        groups: [{ id: 'g-expenses', key: 'expenses', label: 'Expenses' }],
      },
      {
        id: 'salary',
        key: 'salary',
        label: 'Salary',
        icon: '💼',
        groups: [{ id: 'g-income', key: 'income', label: 'Income' }],
      },
      {
        id: 'eating-out',
        key: 'eating-out',
        label: 'Eating out',
        icon: '🍔',
        groups: [
          { id: 'g-recurring', key: 'recurring', label: 'Recurring' },
          { id: 'g-income', key: 'income', label: 'Income' },
        ],
      },
      {
        id: 'groceries',
        key: 'groceries',
        label: 'Groceries',
        icon: '🛒',
        groups: [{ id: 'g-expenses', key: 'expenses', label: 'Expenses' }],
      },
    ])

    expect(options).toEqual([
      {
        label: '⛽ Fuel',
        value: 'fuel',
        group: 'Expenses',
        groupKey: 'expenses',
      },
      {
        label: '🛒 Groceries',
        value: 'groceries',
        group: 'Expenses',
        groupKey: 'expenses',
      },
      {
        label: '🍔 Eating out',
        value: 'eating-out',
        group: 'Income',
        groupKey: 'income',
      },
      {
        label: '💼 Salary',
        value: 'salary',
        group: 'Income',
        groupKey: 'income',
      },
      {
        label: '🍔 Eating out',
        value: 'eating-out',
        group: 'Recurring',
        groupKey: 'recurring',
      },
    ])
  })

  it('falls back to Other for categories without a group', () => {
    const options = toCategoryOptions([
      { id: 'misc', key: 'misc', label: 'Misc', icon: '📎' },
    ])

    expect(options).toEqual([
      { label: '📎 Misc', value: 'misc', group: 'Other', groupKey: 'other' },
    ])
  })

  it('sorts each section by category name, ignoring the emoji prefix', () => {
    const options = toCategoryOptions([
      {
        id: 'zebra',
        key: 'zebra',
        label: 'Zebra',
        icon: '💼',
        groups: [{ id: 'g-expenses', key: 'expenses', label: 'Expenses' }],
      },
      {
        id: 'apple',
        key: 'apple',
        label: 'Apple',
        icon: '🛒',
        groups: [{ id: 'g-expenses', key: 'expenses', label: 'Expenses' }],
      },
    ])

    expect(options.map((option) => option.value)).toEqual(['apple', 'zebra'])
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

  it('excludes fee rows', () => {
    const withFee = [
      ...rows,
      toStatementTransaction(
        transaction({ id: 'txn-fee', fee: '25.00', money_out: '0.00' }),
      ),
    ]

    expect(filterTransactions(withFee, 'excl-fees', '')).toHaveLength(2)
    expect(filterTransactions(withFee, 'all', '')).toHaveLength(3)
  })

  it('counts all, review and fee rows', () => {
    const filters = buildTransactionFilters(rows, 2, 1)
    expect(filters[0]).toEqual({ id: 'all', label: 'All', count: 2 })
    expect(filters[1]).toEqual({
      id: 'review',
      label: 'Needs review',
      count: 1,
    })
    expect(filters[3]).toEqual({
      id: 'excl-fees',
      label: 'Exc. Fees',
      count: 0,
    })
  })

  it('hides the review filter when nothing needs review', () => {
    const filters = buildTransactionFilters(rows, 2, 0)

    expect(filters.map((filter) => filter.id)).toEqual([
      'all',
      'money-in',
      'excl-fees',
    ])
  })
})

describe('formatBudgetWindow', () => {
  it('formats the salary-to-salary window', () => {
    expect(formatBudgetWindow('2026-10-01', '2026-10-31')).toBe(
      '1 Oct – 31 Oct 2026',
    )
  })
})

describe('formatBudgetMonth', () => {
  it('names the month that holds most of the window', () => {
    expect(formatBudgetMonth('2026-10-01', '2026-10-31')).toBe('October 2026')
    // 9 days in September, 24 in October.
    expect(formatBudgetMonth('2026-09-22', '2026-10-24')).toBe('October 2026')
    // 6 days in September, 5 in October.
    expect(formatBudgetMonth('2026-09-25', '2026-10-05')).toBe(
      'September 2026',
    )
  })

  it('leans to the later month when the days are split evenly', () => {
    expect(formatBudgetMonth('2026-09-16', '2026-10-15')).toBe('October 2026')
  })
})
