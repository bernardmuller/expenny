import { fireEvent, render, screen } from '@testing-library/react'

import { ReviewCard } from '../ReviewCard'
import { mockReviewItems } from '../../shared/__mocks__/review.mock'

describe('ReviewCard', () => {
  const onLooksRight = vi.fn()
  const onChange = vi.fn()
  const onSkip = vi.fn()
  const item = mockReviewItems[0]

  beforeEach(() => {
    render(
      <ReviewCard
        item={item}
        index={0}
        total={3}
        onLooksRight={onLooksRight}
        onChange={onChange}
        onSkip={onSkip}
      />,
    )
  })

  it('renders how many transactions are left to review', () => {
    expect(screen.getByText('3 to review')).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('renders the merchant, date and amount', () => {
    expect(screen.getByText(item.merchant)).toBeInTheDocument()
    expect(screen.getByText(item.date)).toBeInTheDocument()
    expect(screen.getByText(item.amount)).toBeInTheDocument()
  })

  it('renders the statement description', () => {
    expect(screen.getByText(item.originalDescription)).toBeInTheDocument()
  })

  it('renders the predicted category and confidence', () => {
    expect(
      document.querySelector('[data-slot="category-pill"]'),
    ).toHaveTextContent(item.category.label)
    expect(screen.getByText('76% sure')).toBeInTheDocument()
  })

  it('calls onLooksRight when confirmed', () => {
    fireEvent.click(screen.getByRole('button', { name: /looks right/i }))
    expect(onLooksRight).toHaveBeenCalled()
  })

  it('calls onChange when the category is changed', () => {
    fireEvent.click(screen.getByRole('button', { name: /change/i }))
    expect(onChange).toHaveBeenCalled()
  })

  it('calls onSkip from the footer action', () => {
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(onSkip).toHaveBeenCalled()
  })
})
