import type { Meta, StoryObj } from '@storybook/react-vite'

import { TransactionList } from './TransactionList'
import {
  mockTransactionFilters,
  mockTransactions,
} from '../shared/__mocks__/transaction.mock'

const meta = {
  title: 'v2/Mobile/Transaction List',
  component: TransactionList,
  parameters: {
    layout: 'centered',
  },
  decorators: (Story) => (
    <div className="w-full max-w-md p-4">
      <Story />
    </div>
  ),
  args: {
    transactions: mockTransactions.slice(0, 7),
    filters: mockTransactionFilters.slice(0, 4),
    activeFilter: 'all',
    totalCount: 48,
    linkProvider: ({ children }) => <a href="/">{children}</a>,
  },
} satisfies Meta<typeof TransactionList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ReviewFilter: Story = {
  args: {
    activeFilter: 'review',
    transactions: mockTransactions.filter((t) => t.needsReview),
  },
}
