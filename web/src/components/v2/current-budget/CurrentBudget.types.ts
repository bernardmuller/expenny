import type { ComponentType, ReactNode } from 'react'

export type CurrentBudgetBaseProps = {
  budgetName: string
  /** Drives the card heading; falls back to "Current Budget" without one. */
  budgetMonth?: string
  currentAmount: string
  startingAmount: string
  spentAmount: string
  spentPercentage: number
  daysLeft?: number
  onClick?: () => void
  onEdit?: () => void
}

export type CurrentBudgetProps = CurrentBudgetBaseProps & {
  linkProvider?: ComponentType<{ children: ReactNode }>
}
