import { fireEvent, render, screen } from '@testing-library/react'

import { BudgetPeriodDialog } from '../BudgetPeriodDialog'

const preferences = {
  start_date: '2026-10-01',
  end_date: '2026-10-31',
  account: null,
}

describe('BudgetPeriodDialog', () => {
  const onOpenChange = vi.fn()
  const onSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefills the saved period', () => {
    render(
      <BudgetPeriodDialog
        open
        onOpenChange={onOpenChange}
        preferences={preferences}
        accounts={['1594035723']}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('End date')).toHaveValue('2026-10-31')
  })

  it('submits the selected period and clears the account when all is chosen', () => {
    render(
      <BudgetPeriodDialog
        open
        onOpenChange={onOpenChange}
        preferences={preferences}
        accounts={['1594035723']}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save period' }))
    expect(onSubmit).toHaveBeenCalledWith({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      account: null,
    })
  })

  it('refuses to submit a window that ends before it starts', () => {
    render(
      <BudgetPeriodDialog
        open
        onOpenChange={onOpenChange}
        preferences={preferences}
        accounts={[]}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-09-01' },
    })

    expect(
      screen.getByText('The end date has to be on or after the start date.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save period' })).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
