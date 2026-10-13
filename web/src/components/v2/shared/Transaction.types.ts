import type { ComponentType, ReactNode } from 'react'

export type TransactionCategory = {
  id: string
  label: string
  icon: string
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
  counted?: boolean
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
}
