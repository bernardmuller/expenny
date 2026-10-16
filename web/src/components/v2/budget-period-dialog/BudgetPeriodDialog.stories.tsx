import type { Meta, StoryObj } from '@storybook/react-vite'

import { BudgetPeriodDialog } from './BudgetPeriodDialog'

const meta = {
  title: 'v2/Budget Period Dialog',
  component: BudgetPeriodDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
    preferences: {
      start_date: '2026-10-01',
      end_date: '2026-10-31',
      account: null,
    },
    accounts: ['1594035723', '1594099999'],
    onSubmit: () => {},
  },
} satisfies Meta<typeof BudgetPeriodDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Configured: Story = {}

export const FirstTime: Story = {
  args: {
    preferences: null,
    accounts: [],
  },
}

export const Saving: Story = {
  args: {
    isSaving: true,
  },
}
