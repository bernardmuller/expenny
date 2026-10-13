import { fireEvent, render, screen } from '@testing-library/react'

import { CurrentBudget } from '../CurrentBudget'
import { generateCurrentBudgetProps } from '../__mocks__/CurrentBudget.mock'

describe('CurrentBudget', () => {
  const {
    budgetName,
    currentAmount,
    spentAmount,
    spentPercentage,
    startingAmount,
    daysLeft,
    linkProvider,
    onClick,
  } = generateCurrentBudgetProps({
    onClick: vi.fn(),
    spentPercentage: 25,
    currentAmount: 'R 3 000',
    spentAmount: 'R 1 000',
    startingAmount: 'R 4 000',
    daysLeft: 11,
  })

  beforeEach(() => {
    render(
      <CurrentBudget
        budgetName={budgetName}
        currentAmount={currentAmount}
        spentAmount={spentAmount}
        spentPercentage={spentPercentage}
        startingAmount={startingAmount}
        daysLeft={daysLeft}
        linkProvider={linkProvider}
        onClick={onClick}
      />,
    )
  })

  it('should render the title with the budget name', () => {
    expect(
      screen.getByText(`Current Budget · ${budgetName}`),
    ).toBeInTheDocument()
  })

  it('should render the days left badge', () => {
    expect(screen.getByText('11 days left')).toBeInTheDocument()
  })

  it('should render the remaining amount and the starting amount', () => {
    expect(screen.getByText(currentAmount)).toBeInTheDocument()
    expect(screen.getByText(`left of ${startingAmount}`)).toBeInTheDocument()
  })

  it('should render the spent amount', () => {
    expect(screen.getByText(`Spent ${spentAmount}`)).toBeInTheDocument()
  })

  it('should render the spent percentage', () => {
    expect(screen.getByText('25.0%')).toBeInTheDocument()
  })

  it('should call onClick when the amount is clicked', () => {
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Toggle remaining amount visibility',
      }),
    )
    expect(onClick).toHaveBeenCalled()
  })

  it('should render a link when a linkProvider is supplied', () => {
    expect(screen.getByRole('link')).toBeInTheDocument()
  })
})
