import { fireEvent, render, screen } from '@testing-library/react'

import { ReviewPanel } from '../ReviewPanel'
import {
  mockCategoryOptions,
  mockReviewItems,
} from '../../shared/__mocks__/review.mock'

describe('ReviewPanel', () => {
  const onConfirm = vi.fn()
  const onSkip = vi.fn()
  const onCountsTowardBudgetChange = vi.fn()
  const item = mockReviewItems[1]

  beforeEach(() => {
    render(
      <ReviewPanel
        item={item}
        index={1}
        total={3}
        displayName="Takealot"
        categoryId="shopping"
        categoryOptions={mockCategoryOptions}
        countsTowardBudget
        onConfirm={onConfirm}
        onSkip={onSkip}
        onCountsTowardBudgetChange={onCountsTowardBudgetChange}
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
    expect(screen.getByDisplayValue('🛍️ Shopping')).toBeInTheDocument()
  })

  it('renders the confidence hint', () => {
    expect(screen.getByText('62% sure')).toBeInTheDocument()
  })

  it('renders the expense probability subtitle', () => {
    expect(
      screen.getByText('Model says 93% likely an expense'),
    ).toBeInTheDocument()
  })

  it('calls onConfirm when confirming', () => {
    fireEvent.click(screen.getByRole('button', { name: /confirm and next/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('toggles counts toward budget', () => {
    fireEvent.click(screen.getByRole('switch'))
    expect(onCountsTowardBudgetChange).toHaveBeenCalledWith(false)
  })

  it('calls onSkip', () => {
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(onSkip).toHaveBeenCalled()
  })
})
