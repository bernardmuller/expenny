import { fireEvent, render, screen } from '@testing-library/react'

import { TransactionList } from '../TransactionList'
import {
  mockTransactionFilters,
  mockTransactions,
} from '../../shared/__mocks__/transaction.mock'

describe('TransactionList', () => {
  const onFilterChange = vi.fn()
  const onSelect = vi.fn()

  beforeEach(() => {
    render(
      <TransactionList
        transactions={mockTransactions.slice(0, 7)}
        filters={mockTransactionFilters}
        activeFilter="all"
        totalCount={48}
        onFilterChange={onFilterChange}
        onSelect={onSelect}
        linkProvider={({ children }) => <a href="/">{children}</a>}
      />,
    )
  })

  it('renders the header and view all link', () => {
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'View all 48' }),
    ).toBeInTheDocument()
  })

  it('renders the filter chips', () => {
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Needs review' }),
    ).toBeInTheDocument()
  })

  it('marks the active filter as pressed', () => {
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'data-state',
      'on',
    )
  })

  it('calls onFilterChange when a filter is selected', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Needs review' }))
    expect(onFilterChange).toHaveBeenCalledWith('review')
  })

  it('renders transactions with their category', () => {
    expect(screen.getByText('Woolworths Food')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('R 642.30')).toBeInTheDocument()
  })

  it('flags transactions that need review', () => {
    expect(screen.getAllByText('Review')).toHaveLength(3)
  })

  it('marks uncounted transactions', () => {
    expect(screen.getByText('Not counted · 7 Oct')).toBeInTheDocument()
  })

  it('calls onSelect when a row is clicked', () => {
    fireEvent.click(screen.getByText('Woolworths Food'))
    expect(onSelect).toHaveBeenCalledWith('transaction-1')
  })
})
