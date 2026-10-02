import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { generateRecentExpenseProps } from '../__mocks__/RecentExpense.mock'
import RecentExpense from '../RecentExpense'

describe('RecentExpense', () => {
  it('should render the description', () => {
    const { amount, description, emoji, categoryLabel } =
      generateRecentExpenseProps({
        description: 'Test Description',
      })
    render(
      <RecentExpense
        amount={amount}
        description={description}
        emoji={emoji}
        categoryLabel={categoryLabel}
      />,
    )
    expect(screen.getByText(/Test Description/i)).toBeInTheDocument()
  })
  it('should render the amount', () => {
    const { amount, description, emoji, categoryLabel } =
      generateRecentExpenseProps({
        amount: 'R1000',
      })
    render(
      <RecentExpense
        amount={amount}
        description={description}
        emoji={emoji}
        categoryLabel={categoryLabel}
      />,
    )
    expect(screen.getByText(/R1000/i)).toBeInTheDocument()
  })
  it('should render the emoji', () => {
    const { amount, description, emoji, categoryLabel } =
      generateRecentExpenseProps({
        emoji: '💳',
      })
    render(
      <RecentExpense
        amount={amount}
        description={description}
        emoji={emoji}
        categoryLabel={categoryLabel}
      />,
    )
    expect(screen.getByText(/💳/i)).toBeInTheDocument()
  })
  it('should render the category label', () => {
    const { amount, description, emoji, categoryLabel } =
      generateRecentExpenseProps({
        categoryLabel: 'Food & Dining',
      })
    render(
      <RecentExpense
        amount={amount}
        description={description}
        emoji={emoji}
        categoryLabel={categoryLabel}
      />,
    )
    expect(screen.getByText(/Food & Dining/i)).toBeInTheDocument()
  })
  it('should not render the actions menu without an onDelete handler', () => {
    render(<RecentExpense {...generateRecentExpenseProps()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('should render the actions menu at any screen size when onDelete is given', async () => {
    const user = userEvent.setup()
    const props = generateRecentExpenseProps({
      description: 'Flat white',
      onDelete: vi.fn(),
    })
    render(<RecentExpense {...props} />)

    await user.click(
      screen.getByRole('button', { name: /actions for flat white/i }),
    )

    expect(
      await screen.findByRole('menuitem', { name: /delete/i }),
    ).toBeInTheDocument()
  })
  it('should call onDelete when the delete menu item is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const props = generateRecentExpenseProps({
      description: 'Flat white',
      onDelete,
    })
    render(<RecentExpense {...props} />)

    await user.click(
      screen.getByRole('button', { name: /actions for flat white/i }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
