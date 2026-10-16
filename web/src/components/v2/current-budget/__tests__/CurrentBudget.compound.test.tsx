import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import * as CurrentBudget from '../CurrentBudget.compound'

describe('CurrentBudget.Root', () => {
  it('renders children', () => {
    render(<CurrentBudget.Root>Test Content</CurrentBudget.Root>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('merges custom className', () => {
    const { container } = render(
      <CurrentBudget.Root className="custom-class">Content</CurrentBudget.Root>,
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('CurrentBudget.Header', () => {
  it('renders children', () => {
    render(<CurrentBudget.Header>Header</CurrentBudget.Header>)
    expect(screen.getByText('Header')).toBeInTheDocument()
  })
})

describe('CurrentBudget.Title', () => {
  it('renders children', () => {
    render(
      <CurrentBudget.Title>Current Budget · October 2026</CurrentBudget.Title>,
    )
    expect(
      screen.getByText('Current Budget · October 2026'),
    ).toBeInTheDocument()
  })
})

describe('CurrentBudget.DaysLeftBadge', () => {
  it.each([
    [11, '11 days left'],
    [1, 'Ends Tomorrow'],
    [0, 'Budget End'],
    [-1, 'Ended Yesterday'],
    [-3, '3 days past'],
  ])('renders %s as "%s"', (daysLeft, label) => {
    render(<CurrentBudget.DaysLeftBadge daysLeft={daysLeft} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('turns the ended badge solid red with a lifted lip', () => {
    render(<CurrentBudget.DaysLeftBadge daysLeft={0} />)

    const badge = screen.getByText('Budget End')
    expect(badge).toHaveClass('bg-destructive', 'hover:-translate-y-px')
    expect(badge).not.toHaveClass('bg-destructive/15')
  })

  it('keeps a running budget on the neutral chip', () => {
    render(<CurrentBudget.DaysLeftBadge daysLeft={11} />)

    expect(screen.getByText('11 days left')).toHaveClass('bg-raised')
  })
})

describe('CurrentBudget.Remaining', () => {
  it('renders the amount and the starting amount', () => {
    render(<CurrentBudget.Remaining amount="R 4 632" of="R 24 000" />)
    expect(screen.getByText('R 4 632')).toBeInTheDocument()
    expect(screen.getByText('remaining of R 24 000')).toBeInTheDocument()
  })
})

describe('CurrentBudget.ProgressBar', () => {
  it('exposes the percentage to assistive tech', () => {
    render(<CurrentBudget.ProgressBar percentage={80.7} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '80.7',
    )
  })

  it('clamps values above 100', () => {
    render(<CurrentBudget.ProgressBar percentage={140} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })
})

describe('CurrentBudget.Footer', () => {
  it('renders children', () => {
    render(<CurrentBudget.Footer>Footer</CurrentBudget.Footer>)
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })
})

describe('CurrentBudget.Spent', () => {
  it('renders the spent amount', () => {
    render(<CurrentBudget.Spent amount="R 19 368" />)
    expect(screen.getByText('Spent R 19 368')).toBeInTheDocument()
  })
})

describe('CurrentBudget.Percentage', () => {
  it('formats the percentage', () => {
    render(<CurrentBudget.Percentage value={80.7} />)
    expect(screen.getByText('80.7%')).toBeInTheDocument()
  })
})
