import { faker } from '@faker-js/faker'

import { calculateSpentPercentage } from '@/lib/utils/calculations/calculateSpentPercentage'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'

import type { CurrentBudgetProps } from '../CurrentBudget.types'

const startingAmount = faker.number.int({ min: 9000, max: 199999 })
const spentAmount = faker.number.int({ min: 0, max: startingAmount })
const currentAmount = startingAmount - spentAmount

export const currentBudgetProps: CurrentBudgetProps = {
  budgetName: `October ${faker.date.future().getFullYear()}`,
  startingAmount: formatCurrency(startingAmount, 'za'),
  spentAmount: formatCurrency(spentAmount, 'za'),
  spentPercentage: calculateSpentPercentage(startingAmount, spentAmount),
  currentAmount: formatCurrency(currentAmount, 'za'),
  daysLeft: faker.number.int({ min: 1, max: 31 }),
  onClick: () => {},
  linkProvider: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}
