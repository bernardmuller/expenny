import type { BudgetPreferences } from '@/lib/http/v2/types'

export type BudgetPeriodInput = {
  startDate: string
  endDate: string
  account: string | null
}

export type BudgetPeriodDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: BudgetPreferences | null
  accounts: Array<string>
  isSaving?: boolean
  onSubmit: (input: BudgetPeriodInput) => void
}
