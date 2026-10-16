import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'

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

/**
 * Direction from the statement amounts rather than the classifier: the user
 * decides whether a row is an expense or income from money_out vs money_in,
 * and the category pickers filter their groups with this.
 */
export function transactionDirection(
  transaction: ApiStatementTransaction,
): 'in' | 'out' {
  const moneyIn = Math.abs(parseAmount(transaction.money_in))
  const moneyOut = Math.abs(parseAmount(transaction.money_out))
  if (moneyIn !== 0 && moneyOut === 0) return 'in'
  return 'out'
}

export function transactionCategory(
  transaction: ApiStatementTransaction,
): TransactionCategory {
  const category = transaction.classification?.category
  if (!category) return UNCATEGORISED
  return {
    id: category.id,
    label: category.label,
    icon: category.icon,
    group: transaction.classification?.group ?? undefined,
  }
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
  const isFee =
    parseAmount(transaction.fee) !== 0 ||
    transaction.classification?.category?.key === 'bank-fees'

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
    // Rows without a classification cannot be marked seen yet.
    seen: transaction.classification
      ? transaction.classification.seen_at != null
      : undefined,
    isFee,
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
    group: transaction.classification?.group ?? '',
    isIncome: direction === 'in',
    confidence: transactionConfidence(transaction) ?? 0,
    balanceAfter: transaction.balance
      ? formatRand(parseAmount(transaction.balance))
      : '—',
  }
}

export function toCategoryOptions(
  categories: Array<StatementCategory>,
): Array<CategoryOption> {
  // A category can sit in several groups, so it becomes one option per
  // membership. Sort by the category name first (not the emoji-prefixed label
  // the picker renders), then stably by group, so every section is
  // alphabetical by name and the sections themselves sort alphabetically.
  const byName = [...categories].sort((a, b) => a.label.localeCompare(b.label))

  const options: Array<CategoryOption> = byName.flatMap((category) => {
    const groups = category.groups?.length
      ? category.groups
      : [{ key: 'other', label: 'Other' }]

    return groups.map((group) => ({
      label: `${category.icon} ${category.label}`.trim(),
      value: category.id,
      group: group.label,
      groupKey: group.key,
    }))
  })

  return options.sort((a, b) => (a.group ?? '').localeCompare(b.group ?? ''))
}

/** "1 Oct – 31 Oct 2026" for the dashboard budget period. */
export function formatBudgetWindow(start: string, end: string): string {
  return `${format(parseISO(start), 'd MMM')} – ${format(
    parseISO(end),
    'd MMM yyyy',
  )}`
}

/**
 * The month a budget period belongs to: the calendar month that holds the
 * most days of the window. A calendar-month window reads as that month, and a
 * salary window like 22 Sep – 24 Oct reads as October because most of its
 * days land there.
 */
export function formatBudgetMonth(start: string, end: string): string {
  const startDate = parseISO(start)
  const endDate = parseISO(end)

  let winner = startOfMonth(startDate)
  let winnerDays = 0

  for (let month = winner; month <= endDate; month = addMonths(month, 1)) {
    const first = startDate > month ? startDate : month
    const last = endDate < endOfMonth(month) ? endDate : endOfMonth(month)
    const days = differenceInCalendarDays(last, first) + 1
    // A tie leans towards the later month, where the window's midpoint falls.
    if (days >= winnerDays) {
      winner = month
      winnerDays = days
    }
  }

  return format(winner, 'MMMM yyyy')
}

export function buildTransactionFilters(
  transactions: Array<StatementTransaction>,
  totalCount: number,
  reviewCount: number,
): Array<TransactionFilter> {
  return [
    { id: 'all', label: 'All', count: totalCount },
    // The review tab only exists while something is waiting on a human.
    ...(reviewCount > 0
      ? [{ id: 'review', label: 'Needs review', count: reviewCount }]
      : []),
    { id: 'money-in', label: 'Money in' },
    {
      id: 'excl-fees',
      label: 'Exc. Fees',
      // Fee rows can only be counted from the loaded pages.
      count: transactions.filter((transaction) => transaction.isFee).length,
    },
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
      case 'excl-fees':
        return !transaction.isFee
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
