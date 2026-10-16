import type { ComponentType, ReactNode } from 'react'

import type { CategoryOption } from './Review.types'

export type TransactionCategory = {
  id: string
  label: string
  icon: string
  /** Group key the transaction is tagged with, when known. */
  group?: string
}

export type StatementTransaction = {
  id: string
  date: string
  description: string
  originalDescription?: string
  category: TransactionCategory
  amount: string
  balance?: string
  confidence?: number
  needsReview?: boolean
  /** True for bank fees (fee amount or the bank-fees category). */
  isFee?: boolean
  direction?: 'in' | 'out'
}

export type TransactionFilter = {
  id: string
  label: string
  count?: number
}

export type TransactionListProps = {
  transactions: Array<StatementTransaction>
  filters: Array<TransactionFilter>
  activeFilter: string
  totalCount: number
  onFilterChange?: (id: string) => void
  onSelect?: (id: string) => void
  linkProvider?: ComponentType<{ children: ReactNode }>
}

export type TransactionTableProps = TransactionListProps & {
  search?: string
  onSearchChange?: (value: string) => void
  selectedId?: string
  shownCount?: number
  className?: string
  categoryOptions?: Array<CategoryOption>
  onCategoryChange?: (
    transactionId: string,
    categoryId: string,
    groupKey: string,
  ) => void
  /** Whether more pages are available from the server. */
  hasMore?: boolean
  /** Whether the next page is currently being fetched. */
  isLoadingMore?: boolean
  /** Called when the table scrolls close to the bottom. */
  onLoadMore?: () => void
}
