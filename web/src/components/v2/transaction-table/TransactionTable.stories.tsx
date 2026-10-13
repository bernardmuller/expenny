import type { Meta, StoryObj } from '@storybook/react-vite'

import { TransactionTable } from './TransactionTable'
import {
  mockTransactionFilters,
  mockTransactions,
} from '../shared/__mocks__/transaction.mock'

const meta = {
  title: 'v2/Desktop/Transaction Table',
  component: TransactionTable,
  parameters: {
    layout: 'padded',
  },
  args: {
    transactions: mockTransactions,
    filters: mockTransactionFilters,
    activeFilter: 'all',
    totalCount: 48,
    shownCount: 10,
    search: '',
    selectedId: 'transaction-4',
    linkProvider: ({ children }) => <a href="/">{children}</a>,
  },
} satisfies Meta<typeof TransactionTable>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NeedsReview: Story = {
  args: {
    activeFilter: 'review',
    transactions: mockTransactions.filter((t) => t.needsReview),
    selectedId: undefined,
  },
}
