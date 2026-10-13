import type { Meta, StoryObj } from '@storybook/react-vite'

import { CurrentBudget } from './CurrentBudget'
import { generateCurrentBudgetProps } from './__mocks__/CurrentBudget.mock'

const currentBudgetProps = generateCurrentBudgetProps()

const meta = {
  title: 'Current Budget/v2',
  component: CurrentBudget,
  parameters: {
    layout: 'centered',
  },
  decorators: (Story) => (
    <div className="w-full max-w-xl">
      <Story />
    </div>
  ),
} satisfies Meta<typeof CurrentBudget>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { ...currentBudgetProps },
}

export const WithoutDaysLeft: Story = {
  args: { ...currentBudgetProps, daysLeft: undefined },
}

export const BudgetEnd: Story = {
  args: { ...currentBudgetProps, daysLeft: 0 },
}

export const EndsTomorrow: Story = {
  args: { ...currentBudgetProps, daysLeft: 1 },
}

export const Ended: Story = {
  args: { ...currentBudgetProps, daysLeft: -2 },
}
