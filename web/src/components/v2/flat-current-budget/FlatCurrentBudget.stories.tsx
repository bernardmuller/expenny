import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { FlatCurrentBudget } from './FlatCurrentBudget'

const meta = {
  title: 'v2/Desktop/Flat Current Budget',
  component: FlatCurrentBudget,
  parameters: {
    layout: 'padded',
  },
  args: {
    budgetName: 'October 2026',
    currentAmount: 'R 4 632',
    startingAmount: 'R 24 000',
    spentAmount: 'R 19 368',
    spentPercentage: 80.7,
    daysLeft: 11,
    linkProvider: ({ children }) => <a href="/">{children}</a>,
  },
} satisfies Meta<typeof FlatCurrentBudget>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutDaysLeft: Story = {
  args: { daysLeft: undefined },
}

export const Toggleable: Story = {
  render: (args) => {
    const [hidden, setHidden] = useState(false)

    return (
      <FlatCurrentBudget
        {...args}
        currentAmount={hidden ? '✱✱✱✱✱✱✱✱' : args.currentAmount}
        startingAmount={hidden ? '✱✱✱✱✱✱✱✱' : args.startingAmount}
        spentAmount={hidden ? '✱✱✱✱✱✱✱✱' : args.spentAmount}
        onClick={() => setHidden((value) => !value)}
      />
    )
  },
}
