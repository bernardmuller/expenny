import type { ComponentType, ReactNode } from 'react'

export type FlatCurrentBudgetProps = {
  budgetName: string
  currentAmount: string
  startingAmount: string
  spentAmount: string
  spentPercentage: number
  daysLeft?: number
  linkProvider?: ComponentType<{ children: ReactNode }>
  onEdit?: () => void
  onClick?: () => void
}
