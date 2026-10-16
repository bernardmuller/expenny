import { fireEvent, render, screen } from '@testing-library/react'

import { FlatCurrentBudget } from '../FlatCurrentBudget'

describe('FlatCurrentBudget', () => {
  const onClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    render(
      <FlatCurrentBudget
        budgetName="October 2026"
        currentAmount="R 4 632"
        startingAmount="R 24 000"
        spentAmount="R 19 368"
        spentPercentage={80.7}
        daysLeft={11}
        onClick={onClick}
        linkProvider={({ children }) => <a href="/">{children}</a>}
      />,
    )
  })

  it('renders the budget period and amounts', () => {
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getByText('R 4 632')).toBeInTheDocument()
    expect(screen.getByText('remaining of R 24 000')).toBeInTheDocument()
  })

  it('renders spend and percentage', () => {
    expect(screen.getByText('Spent: R 19 368')).toBeInTheDocument()
    expect(screen.getByText('80.7%')).toBeInTheDocument()
  })

  it('renders the days left badge', () => {
    expect(screen.getByText('11 days left')).toBeInTheDocument()
  })

  it('links to the budget', () => {
    expect(
      screen.getByRole('link', { name: /current budget/i }),
    ).toBeInTheDocument()
  })

  it('toggles visibility when the amount is clicked', () => {
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Toggle remaining amount visibility',
      }),
    )
    expect(onClick).toHaveBeenCalled()
  })
})
