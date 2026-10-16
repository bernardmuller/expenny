import { describe, expect, it } from 'vitest'

import {
  categoryTint,
  filterCategoryOptionsByDirection,
  groupCategoryOptions,
} from '../categories'
import type { CategoryOption } from '../Review.types'

describe('groupCategoryOptions', () => {
  it('buckets options by group and preserves their order', () => {
    const options: Array<CategoryOption> = [
      { label: 'Fuel', value: 'fuel', group: 'Expenses', groupKey: 'expenses' },
      {
        label: 'Groceries',
        value: 'groceries',
        group: 'Expenses',
        groupKey: 'expenses',
      },
      {
        label: 'Salary',
        value: 'salary',
        group: 'Income',
        groupKey: 'income',
      },
    ]

    expect(groupCategoryOptions(options)).toEqual([
      {
        key: 'expenses',
        label: 'Expenses',
        options: [options[0], options[1]],
      },
      { key: 'income', label: 'Income', options: [options[2]] },
    ])
  })

  it('groups options without a group under Other', () => {
    const options: Array<CategoryOption> = [{ label: 'Misc', value: 'misc' }]

    expect(groupCategoryOptions(options)).toEqual([
      { key: 'other', label: 'Other', options },
    ])
  })
})

describe('categoryTint', () => {
  it('prefers an explicitly mapped colour over the label palette', () => {
    const tint = categoryTint('Groceries', '#123456')

    expect(tint.color).toBe('#123456')
    expect(tint.background).toBe('rgba(18, 52, 86, 0.16)')
  })

  it('falls back to grey without a label or colour', () => {
    expect(categoryTint().color).toBe('#9a9a9a')
  })
})

describe('filterCategoryOptionsByDirection', () => {
  const options: Array<CategoryOption> = [
    { label: 'Fuel', value: 'fuel', group: 'Expenses', groupKey: 'expenses' },
    {
      label: 'Netflix',
      value: 'subscriptions',
      group: 'Recurring',
      groupKey: 'recurring',
    },
    {
      label: 'Transfer',
      value: 'transfer',
      group: 'Transfers',
      groupKey: 'transfers',
    },
    { label: 'Salary', value: 'salary', group: 'Income', groupKey: 'income' },
    {
      label: 'Eating out',
      value: 'eating-out',
      group: 'Income',
      groupKey: 'income',
    },
    { label: 'Misc', value: 'misc' },
  ]

  it('keeps expenses, recurring and transfers for a spend row', () => {
    expect(
      filterCategoryOptionsByDirection(options, false).map(
        (option) => option.value,
      ),
    ).toEqual(['fuel', 'subscriptions', 'transfer', 'misc'])
  })

  it('keeps income and transfers for a money-in row, including mirrored spending categories', () => {
    expect(
      filterCategoryOptionsByDirection(options, true).map(
        (option) => option.value,
      ),
    ).toEqual(['transfer', 'salary', 'eating-out', 'misc'])
  })
})
