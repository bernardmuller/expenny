import type { Meta, StoryObj } from '@storybook/react-vite'

import { createReviewItem } from '../shared/__mocks__/review.mock'

import { TransactionDetails } from './TransactionDetails'

const groceries = createReviewItem({
  id: 'details-1',
  merchant: 'Checkers Hyper',
  emoji: '🛒',
  date: 'Wed 8 Oct 2026',
  amount: 'R 452.90',
  originalDescription: 'CARD PURCHASE CHECKERS HYPER 4529',
  category: { id: 'groceries', label: 'Groceries', icon: '🛒' },
  confidence: 96,
  balanceAfter: 'R 12 341.10',
})

const meta = {
  title: 'v2/Desktop/Transaction Details',
  component: TransactionDetails,
  parameters: {
    layout: 'centered',
  },
  decorators: (Story) => (
    <div className="bg-background font-body text-foreground w-full max-w-sm p-4">
      <Story />
    </div>
  ),
  args: {
    item: groceries,
  },
} satisfies Meta<typeof TransactionDetails>

export default meta

type Story = StoryObj<typeof meta>

export const Classified: Story = {}

export const Transfer: Story = {
  args: {
    item: createReviewItem({
      id: 'details-2',
      merchant: 'Savings transfer',
      emoji: '🏦',
      date: 'Tue 7 Oct 2026',
      amount: 'R 2 000.00',
      originalDescription: 'TRANSFER TO SAVINGS ACCOUNT',
      category: { id: 'transfers', label: 'Transfers', icon: '🏦' },
      confidence: 88,
      balanceAfter: 'R 14 341.10',
    }),
  },
}
