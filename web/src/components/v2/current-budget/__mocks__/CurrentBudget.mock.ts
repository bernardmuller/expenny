import type { CurrentBudgetProps } from '../CurrentBudget.types'
import { currentBudgetProps } from './CurrentBudget.factory'

export const generateCurrentBudgetProps = (
  overwrites: Partial<CurrentBudgetProps> = {},
): CurrentBudgetProps => ({
  ...currentBudgetProps,
  ...overwrites,
})
