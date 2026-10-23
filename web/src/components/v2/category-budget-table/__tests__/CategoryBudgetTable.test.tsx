import { fireEvent, render, screen } from '@testing-library/react'

import type { CategoryBudgetGroup } from '@/lib/http/v2/types'

import { CategoryBudgetTable } from '../CategoryBudgetTable'

const groups: Array<CategoryBudgetGroup> = [
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
        category_budget_id: 'budget-1',
        allocated: '5000.00',
        spent: '4200.00',
      },
      {
        id: 'fuel',
        key: 'fuel',
        label: 'Fuel',
        icon: '⛽',
        group_key: 'expenses',
        category_budget_id: null,
        allocated: null,
        spent: '0.00',
      },
    ],
  },
]

describe('CategoryBudgetTable', () => {
  const onSetBudget = vi.fn()
  const onDeleteBudget = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    render(
      <CategoryBudgetTable
        groups={groups}
        onSetBudget={onSetBudget}
        onDeleteBudget={onDeleteBudget}
        renderExpanded={(categoryId, groupKey) => (
          <div>
            Expanded {categoryId} in {groupKey}
          </div>
        )}
      />,
    )
  })

  it('renders the group and its categories', () => {
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Fuel')).toBeInTheDocument()
    expect(screen.getByText('No budget')).toBeInTheDocument()
  })

  it('expands a category row to show its renderer', () => {
    fireEvent.click(screen.getByText('Groceries').closest('tr')!)

    expect(
      screen.getByText('Expanded groceries in expenses'),
    ).toBeInTheDocument()
  })

  it('saves an inline budget edit', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Set budget for Fuel' }))
    fireEvent.change(screen.getByLabelText('Budget for Fuel'), {
      target: { value: '1500' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSetBudget).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fuel' }),
      1500,
    )
  })

  it('removes an existing budget', () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove budget for Groceries' }),
    )

    expect(onDeleteBudget).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'groceries' }),
    )
  })
})
