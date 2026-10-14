import { format } from 'date-fns'

import type {
  CategoryOption,
  ReviewItem,
} from '@/components/v2/shared/Review.types'
import type {
  StatementTransaction,
  TransactionCategory,
  TransactionFilter,
} from '@/components/v2/shared/Transaction.types'
import type {
  StatementCategory,
  StatementTransaction as ApiStatementTransaction,
} from '@/lib/http/v2/types'

export const UNCATEGORISED: TransactionCategory = {
  id: 'uncategorised',
  label: 'Uncategorised',
  icon: '❔',
}

export function parseAmount(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** "R 1 234.50" — en-ZA grouping with a dot decimal separator. */
export function formatRand(value: number): string {
  const formatted = value
    .toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(',', '.')
  return `R ${formatted}`
}

export function transactionAmount(
  transaction: ApiStatementTransaction,
): number {
  const isExpense = transaction.classification?.is_expense
  const moneyIn = Math.abs(parseAmount(transaction.money_in))
  const moneyOut = Math.abs(parseAmount(transaction.money_out))
  const fee = Math.abs(parseAmount(transaction.fee))

  // Statements write expenses as negative money_out, so the sign cannot be
  // used to pick a column. The classifier's is_expense flag tells us which
  // amount actually left the account.
  if (isExpense === true) return moneyOut !== 0 ? moneyOut : fee
  if (moneyIn !== 0) return moneyIn
  if (moneyOut !== 0) return moneyOut
  return fee
}

export function transactionDirection(
  transaction: ApiStatementTransaction,
): 'in' | 'out' {
  if (transaction.classification?.is_expense === true) return 'out'
  if (parseAmount(transaction.money_in) !== 0) return 'in'
  return 'out'
}

export function transactionCategory(
  transaction: ApiStatementTransaction,
): TransactionCategory {
  const category = transaction.classification?.category
  if (!category) return UNCATEGORISED
  return { id: category.id, label: category.label, icon: category.icon }
}

export function transactionConfidence(
  transaction: ApiStatementTransaction,
): number | undefined {
  const confidence = transaction.classification?.confidence
  if (confidence === null || confidence === undefined) return undefined
  return Math.round(confidence * 100)
}

function transactionMerchant(transaction: ApiStatementTransaction): string {
  return (
    transaction.description.trim() ||
    transaction.original_description.trim() ||
    transaction.account
  )
}

function formatTransactionAmount(transaction: ApiStatementTransaction): string {
  const prefix = transactionDirection(transaction) === 'in' ? '+' : ''
  return `${prefix}${formatRand(transactionAmount(transaction))}`
}

export function toStatementTransaction(
  transaction: ApiStatementTransaction,
): StatementTransaction {
  const direction = transactionDirection(transaction)
  const isExpense = transaction.classification?.is_expense

  return {
    id: transaction.id,
    date: format(new Date(transaction.transaction_date), 'd MMM'),
    description: transactionMerchant(transaction),
    originalDescription: transaction.original_description,
    category: transactionCategory(transaction),
    amount: formatTransactionAmount(transaction),
    balance: transaction.balance
      ? formatRand(parseAmount(transaction.balance))
      : undefined,
    confidence: transactionConfidence(transaction),
    needsReview: transaction.needs_review,
    counted: direction === 'out' && isExpense === false ? false : undefined,
    direction,
  }
}

export function toReviewItem(transaction: ApiStatementTransaction): ReviewItem {
  const direction = transactionDirection(transaction)

  return {
    id: transaction.id,
    merchant: transactionMerchant(transaction),
    emoji: transactionCategory(transaction).icon,
    date: format(new Date(transaction.transaction_date), 'EEE d MMM yyyy'),
    amount: formatTransactionAmount(transaction),
    originalDescription: transaction.original_description,
    category: transactionCategory(transaction),
    confidence: transactionConfidence(transaction) ?? 0,
    isExpense: transaction.classification?.is_expense ?? direction === 'out',
    expenseProbability: Math.round(
      (transaction.classification?.expense_prob ?? 0) * 100,
    ),
    balanceAfter: transaction.balance
      ? formatRand(parseAmount(transaction.balance))
      : '—',
  }
}

export function toCategoryOptions(
  categories: Array<StatementCategory>,
): Array<CategoryOption> {
  // Sort by the category name, not the emoji-prefixed label the review UI
  // renders.
  return [...categories]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((category) => ({
      label: `${category.icon} ${category.label}`.trim(),
      value: category.id,
    }))
}

export function buildTransactionFilters(
  transactions: Array<StatementTransaction>,
): Array<TransactionFilter> {
  return [
    { id: 'all', label: 'All', count: transactions.length },
    {
      id: 'review',
      label: 'Needs review',
      count: transactions.filter((transaction) => transaction.needsReview)
        .length,
    },
    { id: 'money-in', label: 'Money in' },
    { id: 'not-counted', label: 'Not counted' },
  ]
}

export function filterTransactions(
  transactions: Array<StatementTransaction>,
  activeFilter: string,
  search: string,
): Array<StatementTransaction> {
  const byFilter = transactions.filter((transaction) => {
    switch (activeFilter) {
      case 'review':
        return transaction.needsReview
      case 'money-in':
        return transaction.direction === 'in'
      case 'not-counted':
        return transaction.counted === false
      default:
        return true
    }
  })

  if (!search) return byFilter

  const needle = search.toLowerCase()
  return byFilter.filter((transaction) =>
    transaction.description.toLowerCase().includes(needle),
  )
}
