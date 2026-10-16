import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createReviewItem,
  mockCategoryOptions,
} from '../../shared/__mocks__/review.mock'
import { TransactionDetails } from '../TransactionDetails'

describe('TransactionDetails', () => {
  const item = createReviewItem({
    merchant: 'Checkers Hyper',
    emoji: '🛒',
    date: 'Wed 8 Oct 2026',
    amount: 'R 452.90',
    originalDescription: 'CARD PURCHASE CHECKERS HYPER 4529',
    category: { id: 'groceries', label: 'Groceries', icon: '🛒' },
    confidence: 96,
    balanceAfter: 'R 12 341.10',
  })

  beforeEach(() => {
    render(<TransactionDetails item={item} />)
  })

  it('renders the merchant, amount and statement copy', () => {
    expect(screen.getByText('Transaction details')).toBeInTheDocument()
    expect(screen.getByText('Checkers Hyper')).toBeInTheDocument()
    expect(screen.getByText('R 452.90')).toBeInTheDocument()
    expect(
      screen.getByText('CARD PURCHASE CHECKERS HYPER 4529'),
    ).toBeInTheDocument()
  })

  it('renders the classification details', () => {
    expect(
      screen.getByText('Groceries', {
        selector: '[data-slot="category-pill"]',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('96% sure')).toBeInTheDocument()
    expect(screen.getByText('Balance after: R 12 341.10')).toBeInTheDocument()
  })

  it('leaves the category read-only without a change handler', () => {
    expect(
      screen.queryByRole('button', { name: /change category/i }),
    ).not.toBeInTheDocument()
  })
})

describe('TransactionDetails category picker', () => {
  const onCategoryChange = vi.fn()
  const item = createReviewItem({
    merchant: 'Checkers Hyper',
    category: { id: 'groceries', label: 'Groceries', icon: '🛒' },
    group: 'expenses',
  })

  beforeEach(() => {
    vi.clearAllMocks()
    render(
      <TransactionDetails
        item={item}
        categoryOptions={mockCategoryOptions}
        onCategoryChange={onCategoryChange}
      />,
    )
  })

  it('reports the chosen category and group', async () => {
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', {
        name: 'Change category for Checkers Hyper',
      }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: '🥡 Eating out' }),
    )

    expect(onCategoryChange).toHaveBeenCalledWith('eating-out', 'recurring')
  })

  it('offers the group sections for a spending row', async () => {
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', {
        name: 'Change category for Checkers Hyper',
      }),
    )

    expect(await screen.findByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Recurring')).toBeInTheDocument()
    expect(screen.getByText('Transfers')).toBeInTheDocument()
    expect(screen.queryByText('Income')).not.toBeInTheDocument()
  })
})
