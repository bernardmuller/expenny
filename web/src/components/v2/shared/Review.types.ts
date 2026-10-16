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
  /** Group key the transaction is tagged with. */
  group: string
  /** True when money_in is set and money_out is not. */
  isIncome: boolean
  confidence: number
  balanceAfter: string
}

export type CategoryOption = {
  label: string
  value: string
  /** Category group used to section pickers. */
  group?: string
  /** Stable key for the group, for React keys and deduping. */
  groupKey?: string
}

export type ReviewCardProps = {
  item: ReviewItem
  index: number
  total: number
  onLooksRight?: () => void
  onChange?: () => void
  onSkip?: () => void
}

export type ReviewPanelProps = {
  item: ReviewItem
  index: number
  total: number
  displayName: string
  categoryId: string
  /** Group key currently selected for the transaction. */
  groupKey: string
  categoryOptions: Array<CategoryOption>
  onDisplayNameChange?: (value: string) => void
  onCategoryChange?: (categoryId: string, groupKey: string) => void
  onPrev?: () => void
  onNext?: () => void
  onConfirm?: () => void
  onSkip?: () => void
}
