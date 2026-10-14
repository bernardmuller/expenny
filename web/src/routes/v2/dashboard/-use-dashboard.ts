import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, format } from 'date-fns'
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import type {
  SortedTransaction,
  UploadStep,
} from '@/components/v2/upload-drawer/UploadDrawer.types'
import { getActiveBudgetQueryOptions } from '@/lib/http/queries/budget'
import { useCorrectTransaction } from '@/lib/http/v2/hooks/use-correct-transaction'
import { useIngestStatement } from '@/lib/http/v2/hooks/use-ingest-statement'
import { getStatementCategoriesQueryOptions } from '@/lib/http/v2/queries/categories'
import { getMeQueryOptions } from '@/lib/http/v2/queries/me'
import { getStatementTransactionsQueryOptions } from '@/lib/http/v2/queries/statements'
import { usePrivacy } from '@/lib/hooks/usePrivacy'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { getPrivacyDisplayValue } from '@/lib/utils/formatting/getPrivacyDisplayValue'

import {
  buildTransactionFilters,
  filterTransactions,
  toCategoryOptions,
  toReviewItem,
  toStatementTransaction,
} from './-mappers'

export type DashboardModel = ReturnType<typeof useDashboard>

export function useDashboard() {
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy()

  const me = useSuspenseQuery(getMeQueryOptions())
  const transactionsQuery = useSuspenseQuery(
    getStatementTransactionsQueryOptions(),
  )
  const categoriesQuery = useSuspenseQuery(getStatementCategoriesQueryOptions())
  // The v2 API has no budget endpoint yet, so the summary card reads the
  // active budget from the v1 API. A missing budget (404) must not break the
  // dashboard, hence retry: false and a graceful fallback below.
  const budgetQuery = useQuery({
    ...getActiveBudgetQueryOptions(),
    retry: false,
  })

  const rawTransactions = transactionsQuery.data.transactions
  const transactions = useMemo(
    () => rawTransactions.map(toStatementTransaction),
    [rawTransactions],
  )

  const reviewQueue = useMemo(
    () => rawTransactions.filter((transaction) => transaction.needs_review),
    [rawTransactions],
  )

  const [activeReviewId, setActiveReviewId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')

  const currentReviewIndex = useMemo(() => {
    const index = reviewQueue.findIndex(
      (transaction) => transaction.id === activeReviewId,
    )
    return index < 0 ? 0 : index
  }, [reviewQueue, activeReviewId])
  const currentReviewRaw = reviewQueue.at(currentReviewIndex) ?? null
  const currentReview = useMemo(
    () => (currentReviewRaw ? toReviewItem(currentReviewRaw) : null),
    [currentReviewRaw],
  )

  const categoryOptions = useMemo(
    () => toCategoryOptions(categoriesQuery.data.categories),
    [categoriesQuery.data.categories],
  )
  const filters = useMemo(
    () => buildTransactionFilters(transactions),
    [transactions],
  )
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, activeFilter, search),
    [transactions, activeFilter, search],
  )
  const totalCount = transactions.length
  const reviewCount = reviewQueue.length

  const selectTransaction = (id: string) => {
    setSelectedId(id)
    const transaction = transactions.find((t) => t.id === id)
    if (transaction?.needsReview) {
      setActiveReviewId(id)
    }
  }

  const reviewIdAfter = (id: string) => {
    const index = reviewQueue.findIndex((transaction) => transaction.id === id)
    const next = reviewQueue.at(index + 1) ?? reviewQueue.at(index - 1)
    return next?.id ?? null
  }

  const correct = useCorrectTransaction()

  const confirmReview = (categoryId: string, isExpense: boolean) => {
    if (!currentReviewRaw) return
    const nextId = reviewIdAfter(currentReviewRaw.id)
    setActiveReviewId(nextId)
    setSelectedId(nextId)
    correct.mutate({
      transactionId: currentReviewRaw.id,
      categoryId,
      isExpense,
    })
  }

  const updateCategory = (transactionId: string, categoryId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId)
    if (!transaction) return

    // Table edits reuse the review panel's correction endpoint. Derive the
    // expense flag the same way `toReviewItem` does.
    const isExpense =
      transaction.direction !== 'in' && transaction.counted !== false

    // A correction clears needs_review, so advance the panel when the row
    // being edited is the one currently under review.
    if (currentReviewRaw?.id === transactionId) {
      const nextId = reviewIdAfter(transactionId)
      setActiveReviewId(nextId)
      setSelectedId(nextId)
    }

    correct.mutate({ transactionId, categoryId, isExpense })
  }

  const skipReview = () => {
    if (!currentReviewRaw) return
    const nextId = reviewIdAfter(currentReviewRaw.id)
    setActiveReviewId(nextId)
    setSelectedId(nextId)
  }

  const moveReview = (offset: number) => {
    if (!currentReviewRaw) return
    const index = reviewQueue.findIndex(
      (transaction) => transaction.id === currentReviewRaw.id,
    )
    const target = reviewQueue.at(index + offset)
    if (!target) return
    setActiveReviewId(target.id)
    setSelectedId(target.id)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')
  const [previousIds, setPreviousIds] = useState<Set<string>>(new Set())
  const ingest = useIngestStatement()

  const openFilePicker = () => fileInputRef.current?.click()

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Let the same file be picked again after a restart of the import.
    event.target.value = ''
    if (!file) return

    setPreviousIds(new Set(rawTransactions.map((t) => t.id)))
    setUploadFileName(file.name)
    setUploadOpen(true)
    ingest.mutate(file)
  }

  const closeUpload = () => {
    ingest.cancel()
    ingest.reset()
    setUploadOpen(false)
  }

  // Rows that appeared after this import started, newest first. The API
  // returns the join ordered by transaction date.
  const ingested = useMemo(() => {
    if (!ingest.isSuccess) return []
    return rawTransactions.filter((t) => !previousIds.has(t.id))
  }, [ingest.isSuccess, rawTransactions, previousIds])

  const uploadSteps = useMemo<Array<UploadStep>>(() => {
    if (ingest.isSuccess) {
      const { processed, classified } = ingest.data
      return [
        {
          id: 'read',
          title: 'Read file',
          description: `${processed} transactions found`,
          status: 'done',
        },
        {
          id: 'sort',
          title: 'Sorting into categories',
          description: 'Matching merchants to your categories',
          status: 'done',
          count: `${classified} of ${processed}`,
          progress:
            processed > 0 ? Math.round((classified / processed) * 100) : 0,
        },
        {
          id: 'review',
          title: 'Ready to review',
          description: "We'll flag anything we're unsure about",
          status: 'active',
          count: `${reviewCount} to review`,
        },
      ]
    }

    return [
      {
        id: 'read',
        title: 'Read file',
        description: uploadFileName
          ? `Reading ${uploadFileName}`
          : 'Waiting for a file',
        status: 'done',
      },
      {
        id: 'sort',
        title: 'Sorting into categories',
        description: 'Matching merchants to your categories',
        status: 'active',
      },
      {
        id: 'review',
        title: 'Ready to review',
        description: "We'll flag anything we're unsure about",
        status: 'pending',
      },
    ]
  }, [ingest.isSuccess, ingest.data, uploadFileName, reviewCount])

  const sorted = useMemo<Array<SortedTransaction>>(
    () =>
      ingested.slice(0, 3).map((transaction) => {
        const display = toStatementTransaction(transaction)
        return {
          id: transaction.id,
          name: display.description,
          emoji: display.category.icon,
          category: display.category.label,
        }
      }),
    [ingested],
  )

  const fileRange = useMemo(() => {
    if (!ingested.length) {
      return uploadFileName ? 'Reading statement…' : ''
    }
    const dates = ingested
      .map((transaction) => new Date(transaction.transaction_date).getTime())
      .sort((a, b) => a - b)
    return `${format(new Date(dates[0]), 'd MMM')} to ${format(
      new Date(dates[dates.length - 1]),
      'd MMM yyyy',
    )}`
  }, [ingested, uploadFileName])

  const budget = budgetQuery.data
  const currentAmount = budget
    ? Math.floor(Number.parseFloat(budget.currentAmount))
    : 0
  const startingAmount = budget
    ? Math.floor(Number.parseFloat(budget.startAmount))
    : 0
  const spentAmount = startingAmount - currentAmount
  const spentPercentage =
    startingAmount > 0 ? (spentAmount / startingAmount) * 100 : 0
  const daysLeft = budget?.endDate
    ? differenceInCalendarDays(new Date(budget.endDate), new Date())
    : undefined

  const latestAccount = rawTransactions[0]?.account
  const statementSummary =
    totalCount === 0
      ? 'No statement imported yet'
      : `${latestAccount} · ${totalCount} sorted · ${reviewCount} to review`

  return {
    user: { name: me.data.name },
    monthLabel: format(new Date(), 'MMMM'),
    statementSummary,
    transactions,
    filteredTransactions,
    filters,
    activeFilter,
    onFilterChange: setActiveFilter,
    search,
    onSearchChange: setSearch,
    totalCount,
    reviewCount,
    selectedId: selectedId ?? currentReviewRaw?.id ?? null,
    onSelect: selectTransaction,
    currentReview,
    currentReviewIndex,
    reviewTotal: reviewCount,
    categoryOptions,
    onCategoryChange: updateCategory,
    confirmReview,
    skipReview,
    onPrevReview: () => moveReview(-1),
    onNextReview: () => moveReview(1),
    budget: {
      budgetName: budget?.name ?? 'No active budget',
      currentAmount: getPrivacyDisplayValue(
        formatCurrency(currentAmount, 'za'),
        isPrivacyEnabled,
      ),
      startingAmount: getPrivacyDisplayValue(
        formatCurrency(startingAmount, 'za'),
        isPrivacyEnabled,
      ),
      spentAmount: getPrivacyDisplayValue(
        formatCurrency(spentAmount, 'za'),
        isPrivacyEnabled,
      ),
      spentPercentage,
      daysLeft,
      onTogglePrivacy: togglePrivacy,
    },
    upload: {
      inputRef: fileInputRef,
      open: uploadOpen,
      fileName: uploadFileName,
      fileRange,
      steps: uploadSteps,
      sorted,
      openPicker: openFilePicker,
      onFileChange,
      close: closeUpload,
    },
  }
}
