import type { CategoryOption, ReviewItem } from '../shared/Review.types'

export type TransactionDetailsProps = {
  item: ReviewItem
  /** When both are provided, the category pill becomes an editable picker. */
  categoryOptions?: Array<CategoryOption>
  onCategoryChange?: (categoryId: string, groupKey: string) => void
  className?: string
}
