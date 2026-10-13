import { fireEvent, render, screen } from '@testing-library/react'

import { TransactionTable } from '../TransactionTable'
import {
  mockTransactionFilters,
  mockTransactions,
} from '../../shared/__mocks__/transaction.mock'

describe('TransactionTable', () => {
  const onFilterChange = vi.fn()
  const onSearchChange = vi.fn()
  const onSelect = vi.fn()

  beforeEach(() => {
    render(
      <TransactionTable
        transactions={mockTransactions}
        filters={mockTransactionFilters}
        activeFilter="all"
        totalCount={48}
        shownCount={10}
        search=""
        selectedId="transaction-4"
        onFilterChange={onFilterChange}
        onSearchChange={onSearchChange}
        onSelect={onSelect}
        linkProvider={({ children }) => <a href="/">{children}</a>}
      />,
    )
  })

  it('renders the column headers', () => {
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Confidence')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.getByText('Balance')).toBeInTheDocument()
  })

  it('renders transaction rows', () => {
    expect(screen.getByText('Woolworths Food')).toBeInTheDocument()
    expect(screen.getByText('R 642.30')).toBeInTheDocument()
    expect(screen.getByText('R 30 858.10')).toBeInTheDocument()
  })

  it('renders money in with a positive amount', () => {
    expect(screen.getByText('+R 38 500.00')).toBeInTheDocument()
  })

  it('marks the selected row', () => {
    const row = screen.getByText('Takealot').closest('tr')
    expect(row).toHaveAttribute('data-state', 'selected')
  })

  it('calls onSelect when a row is clicked', () => {
    fireEvent.click(screen.getByText('Netflix'))
    expect(onSelect).toHaveBeenCalledWith('transaction-7')
  })

  it('calls onFilterChange when a tab is selected', () => {
    fireEvent.mouseDown(screen.getByRole('tab', { name: /needs review/i }))
    expect(onFilterChange).toHaveBeenCalledWith('review')
  })

  it('calls onSearchChange when searching', () => {
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'netflix' },
    })
    expect(onSearchChange).toHaveBeenCalledWith('netflix')
  })

  it('renders the footer summary and link', () => {
    expect(screen.getByText('Showing 10 of 48')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'View all 48 transactions' }),
    ).toBeInTheDocument()
  })
})
