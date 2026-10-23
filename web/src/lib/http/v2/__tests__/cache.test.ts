import type { InfiniteData } from '@tanstack/react-query'

import {
  applyBudgetPreferences,
  applyCategoryAllocation,
  applyCategoryCreated,
  applyCategoryGroupCreated,
  applyCategoryGroupRemoved,
  applyCategoryGroupUpdated,
  applyCategoryRemoved,
  applyCategoryUpdated,
  applyCorrectionCreated,
  applyCorrectionRemoved,
  applyCorrectionUpdated,
  applyGroupPatchedToCategories,
  applyGroupRemovedFromCategories,
  applySelectionCorrection,
  applyTransactionCorrection,
  optimisticId,
} from '../cache'
import type {
  BudgetResponse,
  CategoryBudgetOverview,
  CategoryGroupsResponse,
  CorrectionsResponse,
  StatementCategoriesResponse,
  StatementTransaction,
  StatementTransactionsResponse,
} from '../types'

function transaction(
  overrides: Partial<StatementTransaction> = {},
): StatementTransaction {
  return {
    id: 'txn-1',
    nr: 1,
    account: 'Capitec',
    posting_date: '2026-10-11T00:00:00Z',
    transaction_date: '2026-10-11T14:32:00Z',
    description: 'TAKEALOT.COM ORDER 77402',
    original_description: 'TAKEALOT.COM',
    parent_category: null,
    category: null,
    money_in: '0.00',
    money_out: '899.00',
    fee: '0.00',
    balance: '30000.00',
    classification: null,
    needs_review: true,
    ...overrides,
  }
}

function statementPages(
  transactions: Array<StatementTransaction>,
): InfiniteData<StatementTransactionsResponse> {
  return {
    pages: [
      {
        transactions,
        total: transactions.length,
        review_count: transactions.filter((row) => row.needs_review).length,
        next_offset: null,
      },
    ],
    pageParams: [0],
  }
}

const overview: CategoryBudgetOverview = {
  budget: {
    id: 'budget-1',
    name: 'October',
    start_date: '2026-09-24T22:00:00Z',
    end_date: '2026-10-23T22:00:00Z',
  },
  groups: [
    {
      key: 'expenses',
      label: 'Expenses',
      categories: [
        {
          id: 'groceries',
          key: 'groceries',
          label: 'Groceries',
          icon: '🛒',
          group_key: 'expenses',
          category_budget_id: null,
          allocated: null,
          spent: '120.00',
        },
        {
          id: 'fuel',
          key: 'fuel',
          label: 'Fuel',
          icon: '⛽',
          group_key: 'expenses',
          category_budget_id: 'cb-1',
          allocated: '500.00',
          spent: '450.00',
        },
      ],
    },
  ],
}

const categories: StatementCategoriesResponse = {
  categories: [
    {
      id: 'groceries',
      key: 'groceries',
      label: 'Groceries',
      icon: '🛒',
      groups: [{ id: 'g-1', key: 'expenses', label: 'Expenses' }],
    },
    {
      id: 'fuel',
      key: 'fuel',
      label: 'Fuel',
      icon: '⛽',
      groups: [
        { id: 'g-1', key: 'expenses', label: 'Expenses' },
        { id: 'g-2', key: 'recurring', label: 'Recurring' },
      ],
    },
  ],
}

const groups: CategoryGroupsResponse = {
  groups: [
    { id: 'g-1', key: 'expenses', label: 'Expenses' },
    { id: 'g-2', key: 'recurring', label: 'Recurring' },
  ],
}

describe('applyTransactionCorrection', () => {
  const correction = {
    category: {
      id: 'shopping',
      key: 'shopping',
      label: 'Shopping',
      icon: '📦',
    },
    isExpense: true,
    groupKey: 'expenses',
  }

  it('clears the review flag and drops the review count', () => {
    const data = statementPages([transaction()])

    const next = applyTransactionCorrection(data, 'txn-1', correction)

    expect(next?.pages[0].transactions[0].needs_review).toBe(false)
    expect(next?.pages[0].transactions[0].classification?.category?.id).toBe(
      'shopping',
    )
    expect(next?.pages[0].transactions[0].classification?.source).toBe('human')
    expect(next?.pages[0].review_count).toBe(0)
  })

  it('leaves the review count alone for a row that was already classified', () => {
    const data = statementPages([
      transaction({
        needs_review: false,
        classification: {
          id: 'classification-1',
          category: null,
          is_expense: true,
          expense_prob: 0.9,
          confidence: 0.9,
          source: 'provider',
          group: 'expenses',
          classified_at: '2026-10-11T00:00:00Z',
        },
      }),
    ])

    const next = applyTransactionCorrection(data, 'txn-1', correction)

    expect(next?.pages[0].review_count).toBe(0)
  })

  it('returns the cache untouched when the row is not loaded', () => {
    const data = statementPages([transaction()])

    expect(applyTransactionCorrection(data, 'missing', correction)).toBe(data)
    expect(applyTransactionCorrection(undefined, 'txn-1', correction)).toBe(
      undefined,
    )
  })
})

describe('applySelectionCorrection', () => {
  const correction = {
    category: {
      id: 'shopping',
      key: 'shopping',
      label: 'Shopping',
      icon: '📦',
    },
    isExpense: true,
    groupKey: 'expenses',
  }

  it('patches the snapshot of the selected row', () => {
    const next = applySelectionCorrection(transaction(), 'txn-1', correction)

    expect(next?.needs_review).toBe(false)
    expect(next?.classification?.category?.id).toBe('shopping')
    expect(next?.classification?.group).toBe('expenses')
  })

  it('leaves other rows and an empty selection alone', () => {
    const selection = transaction()

    expect(applySelectionCorrection(selection, 'other', correction)).toBe(
      selection,
    )
    expect(applySelectionCorrection(null, 'txn-1', correction)).toBeNull()
    expect(
      applySelectionCorrection(undefined, 'txn-1', correction),
    ).toBeUndefined()
  })
})

describe('applyCategoryAllocation', () => {
  it('sets an allocation by category id', () => {
    const next = applyCategoryAllocation(
      overview,
      { categoryId: 'groceries' },
      { allocated: '900.00', categoryBudgetId: 'temp-1' },
    )

    const groceries = next?.groups[0].categories[0]
    expect(groceries?.allocated).toBe('900.00')
    expect(groceries?.category_budget_id).toBe('temp-1')
  })

  it('updates and clears an allocation by budget id', () => {
    const updated = applyCategoryAllocation(
      overview,
      { categoryBudgetId: 'cb-1' },
      { allocated: '650.00', categoryBudgetId: 'cb-1' },
    )
    expect(updated?.groups[0].categories[1].allocated).toBe('650.00')

    const cleared = applyCategoryAllocation(
      overview,
      { categoryBudgetId: 'cb-1' },
      { allocated: null, categoryBudgetId: null },
    )
    expect(cleared?.groups[0].categories[1].allocated).toBeNull()
    expect(cleared?.groups[0].categories[1].category_budget_id).toBeNull()
  })

  it('tolerates an empty cache', () => {
    expect(
      applyCategoryAllocation(
        undefined,
        { categoryId: 'groceries' },
        { allocated: '1.00', categoryBudgetId: null },
      ),
    ).toBeUndefined()
  })
})

describe('applyBudgetPreferences', () => {
  it('patches the window on the budget card', () => {
    const budget: BudgetResponse = {
      preferences: null,
      current_balance: '2000.00',
      salary_amount: '38500.00',
      salary_transaction: null,
      spent_amount: '36500.00',
      accounts: ['1594035723'],
    }

    const next = applyBudgetPreferences(budget, {
      start_date: '2026-09-22T00:00:00Z',
      end_date: '2026-10-25T00:00:00Z',
      account: '1594035723',
    })

    expect(next?.preferences?.end_date).toBe('2026-10-25T00:00:00Z')
    expect(
      applyBudgetPreferences(undefined, budget.preferences!),
    ).toBeUndefined()
  })
})

describe('category reducers', () => {
  it('adds, patches and removes a category', () => {
    const created = applyCategoryCreated(categories, {
      id: 'temp-1',
      key: 'pets',
      label: 'Pets',
      icon: '🐶',
    })
    expect(created?.categories).toHaveLength(3)
    expect(created?.categories[2].id).toBe('temp-1')

    const updated = applyCategoryUpdated(categories, {
      id: 'fuel',
      key: 'fuel',
      label: 'Transport',
      icon: '🚗',
    })
    expect(updated?.categories[1].label).toBe('Transport')

    const removed = applyCategoryRemoved(categories, 'fuel')
    expect(removed?.categories.map((category) => category.id)).toEqual([
      'groceries',
    ])
  })

  it('mirrors group edits into the category memberships', () => {
    const patched = applyGroupPatchedToCategories(categories, {
      id: 'g-1',
      key: 'expenses',
      label: 'Spending',
    })
    expect(patched?.categories[0].groups?.[0].label).toBe('Spending')
    expect(patched?.categories[1].groups?.[0].label).toBe('Spending')

    const stripped = applyGroupRemovedFromCategories(categories, 'g-1')
    expect(stripped?.categories[0].groups).toEqual([])
    expect(stripped?.categories[1].groups?.map((group) => group.id)).toEqual([
      'g-2',
    ])
  })

  it('adds, patches and removes a category group', () => {
    const created = applyCategoryGroupCreated(groups, {
      id: 'temp-2',
      key: 'savings',
      label: 'Savings',
    })
    expect(created?.groups).toHaveLength(3)

    const updated = applyCategoryGroupUpdated(groups, {
      id: 'g-2',
      key: 'recurring',
      label: 'Subscriptions',
    })
    expect(updated?.groups[1].label).toBe('Subscriptions')

    const removed = applyCategoryGroupRemoved(groups, 'g-1')
    expect(removed?.groups.map((group) => group.id)).toEqual(['g-2'])
  })
})

describe('correction reducers', () => {
  const data: CorrectionsResponse = {
    corrections: [
      {
        id: 'correction-1',
        description: 'checkers claremont',
        category: {
          id: 'groceries',
          key: 'groceries',
          label: 'Groceries',
          icon: '🛒',
        },
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ],
  }

  it('adds a correction', () => {
    const next = applyCorrectionCreated(data, {
      id: 'correction-2',
      description: 'woolworths kenilworth',
      category: {
        id: 'groceries',
        key: 'groceries',
        label: 'Groceries',
        icon: '🛒',
      },
      created_at: '2026-10-02T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    })

    expect(next?.corrections.map((row) => row.id)).toEqual([
      'correction-1',
      'correction-2',
    ])
  })

  it('patches the description and category of one correction', () => {
    const next = applyCorrectionUpdated(data, {
      id: 'correction-1',
      description: 'checkers hyper',
      category: {
        id: 'eating-out',
        key: 'eating-out',
        label: 'Eating out',
        icon: '🍔',
      },
    })

    expect(next?.corrections[0].description).toBe('checkers hyper')
    expect(next?.corrections[0].category.label).toBe('Eating out')
    expect(next?.corrections[0].created_at).toBe('2026-10-01T00:00:00Z')
  })

  it('removes a correction', () => {
    expect(applyCorrectionRemoved(data, 'correction-1')?.corrections).toEqual(
      [],
    )
    expect(applyCorrectionRemoved(undefined, 'correction-1')).toBeUndefined()
  })
})

describe('optimisticId', () => {
  it('prefixes and de-duplicates temporary ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => optimisticId('row')))

    expect(ids.size).toBe(50)
    for (const id of ids) expect(id.startsWith('row-')).toBe(true)
  })
})
