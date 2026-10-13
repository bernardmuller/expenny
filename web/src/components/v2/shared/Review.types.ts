export type ReviewCategory = {
  id: string
  label: string
  icon: string
}

export type ReviewItem = {
  id: string
  merchant: string
  emoji: string
  date: string
  amount: string
  originalDescription: string
  category: ReviewCategory
  confidence: number
  isExpense: boolean
  expenseProbability: number
  balanceAfter: string
}

export type CategoryOption = {
  label: string
  value: string
}

export type ReviewCardProps = {
  item: ReviewItem
  index: number
  total: number
  onLooksRight?: () => void
  onChange?: () => void
  onNotExpense?: () => void
  onSkip?: () => void
}

export type ReviewPanelProps = {
  item: ReviewItem
  index: number
  total: number
  displayName: string
  categoryId: string
  categoryOptions: Array<CategoryOption>
  countsTowardBudget: boolean
  onDisplayNameChange?: (value: string) => void
  onCategoryChange?: (value: string) => void
  onCountsTowardBudgetChange?: (value: boolean) => void
  onPrev?: () => void
  onNext?: () => void
  onConfirm?: () => void
  onSkip?: () => void
}
