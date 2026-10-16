import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'

import { ReviewPanel } from '../ReviewPanel'
import {
  createReviewItem,
  mockCategoryOptions,
  mockReviewItems,
} from '../../shared/__mocks__/review.mock'

describe('ReviewPanel', () => {
  const onConfirm = vi.fn()
  const onSkip = vi.fn()
  const onCategoryChange = vi.fn()
  const item = mockReviewItems[1]

  beforeEach(() => {
    vi.clearAllMocks()
    render(
      <ReviewPanel
        item={item}
        index={1}
        total={3}
        displayName="Takealot"
        categoryId="shopping"
        groupKey="expenses"
        categoryOptions={mockCategoryOptions}
        onConfirm={onConfirm}
        onSkip={onSkip}
        onCategoryChange={onCategoryChange}
      />,
    )
  })

  it('renders the review progress', () => {
    expect(screen.getByText('Needs review · 2 of 3')).toBeInTheDocument()
  })

  it('renders the editable display name', () => {
    expect(screen.getByDisplayValue('Takealot')).toBeInTheDocument()
  })

  it('renders the selected category', () => {
    expect(screen.getByRole('button', { name: 'Shopping' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('sections a spending row into expenses, recurring and transfers', () => {
    expect(screen.queryByText('Income')).not.toBeInTheDocument()
    expect(screen.getByText('Recurring')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Transfers')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('selects a (category, group) pair from the section it was clicked in', () => {
    const recurring = screen.getByRole('group', { name: 'Recurring' })
    fireEvent.click(
      within(recurring).getByRole('button', { name: 'Eating out' }),
    )

    expect(onCategoryChange).toHaveBeenCalledWith('eating-out', 'recurring')
  })

  it('shows income and mirrored spending categories for an income row', () => {
    cleanup()

    const incomeItem = createReviewItem({
      id: 'income-1',
      merchant: 'Split bill repayment',
      category: { id: 'salary', label: 'Salary', icon: '💼' },
      group: 'income',
      isIncome: true,
    })

    render(
      <ReviewPanel
        item={incomeItem}
        index={0}
        total={1}
        displayName="Split bill repayment"
        categoryId="salary"
        groupKey="income"
        categoryOptions={mockCategoryOptions}
      />,
    )

    const income = screen.getByRole('group', { name: 'Income' })
    expect(
      within(income).getByRole('button', { name: 'Salary' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(income).getByRole('button', { name: 'Eating out' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Expenses' }),
    ).not.toBeInTheDocument()
  })

  it('renders the confidence hint', () => {
    expect(screen.getByText('62% sure')).toBeInTheDocument()
  })

  it('calls onConfirm when confirming', () => {
    fireEvent.click(screen.getByRole('button', { name: /confirm and next/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onSkip', () => {
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(onSkip).toHaveBeenCalled()
  })
})
