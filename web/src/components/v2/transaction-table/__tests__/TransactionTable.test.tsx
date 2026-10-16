import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'

import { TransactionTable } from '../TransactionTable'
import {
  createTransaction,
  mockTransactionFilters,
  mockTransactions,
} from '../../shared/__mocks__/transaction.mock'

describe('TransactionTable', () => {
  const onFilterChange = vi.fn()
  const onSearchChange = vi.fn()
  const onSelect = vi.fn()
  const onCategoryChange = vi.fn()

  const categoryOptions = [
    {
      label: '🍔 Eating out',
      value: 'eating-out',
      group: 'Recurring',
      groupKey: 'recurring',
    },
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
      label: '💼 Salary',
      value: 'salary',
      group: 'Income',
      groupKey: 'income',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    render(
      <TransactionTable
        transactions={mockTransactions}
        filters={mockTransactionFilters}
        activeFilter="all"
        totalCount={48}
        shownCount={10}
        search=""
        selectedId="transaction-4"
        categoryOptions={categoryOptions}
        onCategoryChange={onCategoryChange}
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

  it('changes the view filter from the menu', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^all/i }))
    await user.click(
      await screen.findByRole('menuitem', { name: /needs review/i }),
    )

    expect(onFilterChange).toHaveBeenCalledWith('review')
  })

  it('opens the category menu and calls onCategoryChange on select', async () => {
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', {
        name: 'Change category for Groceries',
      }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: '🍔 Eating out' }),
    )

    expect(onCategoryChange).toHaveBeenCalledWith(
      'transaction-1',
      'eating-out',
      'recurring',
    )
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('groups the category menu by category group', async () => {
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', {
        name: 'Change category for Groceries',
      }),
    )

    expect(await screen.findByText('Recurring')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
  })

  it('disables the currently selected category in the menu', async () => {
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', {
        name: 'Change category for Groceries',
      }),
    )

    expect(
      await screen.findByRole('menuitem', { name: '🛒 Groceries' }),
    ).toHaveAttribute('data-disabled')
  })

  it('shows only income categories for a money-in row', async () => {
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', { name: 'Change category for Income' }),
    )

    expect(
      await screen.findByRole('menuitem', { name: '💼 Salary' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: '⛽ Fuel' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: '🍔 Eating out' }),
    ).not.toBeInTheDocument()
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

  it('highlights unseen rows until they are ticked off', () => {
    const onToggleSeen = vi.fn()
    render(
      <TransactionTable
        transactions={[
          createTransaction({
            id: 'txn-unseen',
            description: 'Unseen Merchant',
            seen: false,
          }),
          createTransaction({
            id: 'txn-seen',
            description: 'Seen Merchant',
            seen: true,
          }),
          createTransaction({
            id: 'txn-pending',
            description: 'Pending Merchant',
          }),
        ]}
        filters={mockTransactionFilters}
        activeFilter="all"
        totalCount={3}
        onSelect={onSelect}
        onToggleSeen={onToggleSeen}
      />,
    )

    const unseenRow = screen.getByText('Unseen Merchant').closest('tr')
    expect(unseenRow).toHaveClass(
      '[&>td]:bg-chart-2/10',
      '[&>td]:border-chart-2/45',
    )

    const checkbox = screen.getByRole('checkbox', {
      name: /mark "Unseen Merchant" as seen/i,
    })
    // An unseen row shows the empty box; ticking replaces it with a bare
    // check.
    expect(checkbox).toHaveClass('bg-card', 'border-muted-foreground/40')
    fireEvent.click(checkbox)

    expect(onToggleSeen).toHaveBeenCalledWith('txn-unseen')
    // Ticking the box must not also open the row's details panel.
    expect(onSelect).not.toHaveBeenCalled()

    expect(screen.getByRole('checkbox', { name: 'Seen' })).toBeDisabled()
    // Rows without a classification cannot be marked seen yet.
    expect(
      screen.queryByRole('checkbox', { name: /Pending Merchant/i }),
    ).not.toBeInTheDocument()
  })

  it('ticks only the clicked row', () => {
    function Harness() {
      const [seen, setSeen] = useState<Record<string, boolean>>({
        'txn-a': false,
        'txn-b': false,
        'txn-c': false,
      })

      return (
        <TransactionTable
          transactions={['a', 'b', 'c'].map((suffix) =>
            createTransaction({
              id: `txn-${suffix}`,
              description: `Merchant ${suffix.toUpperCase()}`,
              seen: seen[`txn-${suffix}`],
            }),
          )}
          filters={mockTransactionFilters}
          activeFilter="all"
          totalCount={3}
          onToggleSeen={(id) => setSeen((old) => ({ ...old, [id]: true }))}
        />
      )
    }

    render(<Harness />)

    const checked = () =>
      screen
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-checked'))

    expect(checked()).toEqual(['false', 'false', 'false'])

    fireEvent.click(
      screen.getByRole('checkbox', { name: /mark "Merchant B" as seen/i }),
    )

    expect(checked()).toEqual(['false', 'true', 'false'])
  })
})
