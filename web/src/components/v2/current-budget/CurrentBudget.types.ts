import type { ComponentType, ReactNode } from 'react'

export type CurrentBudgetBaseProps = {
  budgetName: string
  currentAmount: string
  startingAmount: string
  spentAmount: string
  spentPercentage: number
  daysLeft?: number
  onClick?: () => void
}

export type CurrentBudgetProps = CurrentBudgetBaseProps & {
  linkProvider?: ComponentType<{ children: ReactNode }>
}
