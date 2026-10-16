import {
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  SortedTransaction,
  UploadDrawerStatus,
  UploadStep,
  UploadSummary,
} from '@/components/v2/upload-drawer/UploadDrawer.types'
import type { BudgetPeriodInput } from '@/components/v2/budget-period-dialog/BudgetPeriodDialog.types'
import { useCorrectTransaction } from '@/lib/http/v2/hooks/use-correct-transaction'
import { useMarkTransactionSeen } from '@/lib/http/v2/hooks/use-mark-transaction-seen'
import { useUpdateTransactionCategory } from '@/lib/http/v2/hooks/use-update-transaction-category'
import { useIngestStatement } from '@/lib/http/v2/hooks/use-ingest-statement'
import {
  getBudgetQueryOptions,
  useUpdateBudgetPreferences,
} from '@/lib/http/v2/queries/budget'
import {
  getCategoryBudgetsQueryOptions,
  useDeleteCategoryBudget,
  useSetCategoryBudget,
  useUpdateCategoryBudget,
} from '@/lib/http/v2/queries/category-budgets'
import { getStatementCategoriesQueryOptions } from '@/lib/http/v2/queries/categories'
import { queryKeys } from '@/lib/http/query-keys'
import { getMeQueryOptions } from '@/lib/http/v2/queries/me'
import { getStatementTransactionsQueryOptions } from '@/lib/http/v2/queries/statements'
import type {
  CategoryBudgetCategory,
  StatementTransaction as ApiStatementTransaction,
} from '@/lib/http/v2/types'
import { usePrivacy } from '@/lib/hooks/usePrivacy'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { getPrivacyDisplayValue } from '@/lib/utils/formatting/getPrivacyDisplayValue'

import {
  buildTransactionFilters,
  filterTransactions,
  formatBudgetMonth,
  formatBudgetWindow,
  toCategoryOptions,
  toReviewItem,
  toStatementTransaction,
  transactionDirection,
} from './-mappers'

const SUCCESS_CLOSE_DELAY = 3000

export type DashboardModel = ReturnType<typeof useDashboard>

export function useDashboard() {
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy()
  const queryClient = useQueryClient()
  const [dashboardView, setDashboardView] = useState<
    'transactions' | 'budget' | 'categories' | 'corrections'
  >('transactions')

  const me = useSuspenseQuery(getMeQueryOptions())
  const transactionsQuery = useSuspenseInfiniteQuery(
    getStatementTransactionsQueryOptions(),
  )
  const categoriesQuery = useSuspenseQuery(getStatementCategoriesQueryOptions())
  const budgetQuery = useQuery({ ...getBudgetQueryOptions(), retry: false })
  const updateBudgetPreferences = useUpdateBudgetPreferences()
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const categoryBudgetsQuery = useQuery({
    ...getCategoryBudgetsQueryOptions(),
    enabled: dashboardView === 'budget',
  })
  const setCategoryBudget = useSetCategoryBudget()
  const updateCategoryBudget = useUpdateCategoryBudget()
  const deleteCategoryBudget = useDeleteCategoryBudget()

  const rawTransactions = useMemo(
    () => transactionsQuery.data.pages.flatMap((page) => page.transactions),
    [transactionsQuery.data],
  )
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
  // The details panel can be opened from a list the paginated cache does not
  // hold (an expanded category). Keeping that snapshot in the query cache lets
  // corrections patch it and roll it back alongside the paginated pages.
  const selectedOverride =
    useQuery<ApiStatementTransaction | null>({
      queryKey: queryKeys.statements.selection,
      queryFn: () => null,
      enabled: false,
      staleTime: Infinity,
    }).data ?? null
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

  // The row the user highlighted in the table. When it is already classified
  // the right column shows its details instead of an idle review panel.
  const selectedRaw = useMemo(() => {
    if (!selectedId) return null
    // Prefer the freshest copy in the paginated cache; the snapshot is only
    // the fallback for rows those pages do not hold.
    return (
      rawTransactions.find((transaction) => transaction.id === selectedId) ??
      (selectedOverride?.id === selectedId ? selectedOverride : null)
    )
  }, [rawTransactions, selectedId, selectedOverride])
  const selectedTransaction = useMemo(
    () => (selectedRaw ? toReviewItem(selectedRaw) : null),
    [selectedRaw],
  )
  const showSelectedDetails =
    Boolean(selectedTransaction) && !selectedRaw?.needs_review

  const categoryOptions = useMemo(
    () => toCategoryOptions(categoriesQuery.data.categories),
    [categoriesQuery.data.categories],
  )
  // Every category icon in the app is tinted from this list, so it has to be
  // stable between renders.
  const categoryLabels = useMemo(
    () => categoriesQuery.data.categories.map((category) => category.label),
    [categoriesQuery.data.categories],
  )
  const filters = useMemo(
    () =>
      buildTransactionFilters(
        transactions,
        transactionsQuery.data.pages[0]?.total ?? 0,
        transactionsQuery.data.pages[0]?.review_count ?? 0,
      ),
    [transactions, transactionsQuery.data],
  )
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, activeFilter, search),
    [transactions, activeFilter, search],
  )
  const totalCount = transactionsQuery.data.pages[0]?.total ?? 0
  const reviewCount = transactionsQuery.data.pages[0]?.review_count ?? 0

  const selectTransaction = (
    id: string,
    transaction?: ApiStatementTransaction,
  ) => {
    setSelectedId(id)
    queryClient.setQueryData(
      queryKeys.statements.selection,
      transaction ?? null,
    )
    const raw = transaction ?? rawTransactions.find((t) => t.id === id)
    if (raw?.needs_review) {
      setActiveReviewId(id)
    }
  }

  const reviewIdAfter = (id: string) => {
    const index = reviewQueue.findIndex((transaction) => transaction.id === id)
    const next = reviewQueue.at(index + 1) ?? reviewQueue.at(index - 1)
    return next?.id ?? null
  }

  const correct = useCorrectTransaction()
  // One-off edits (table and details panel) touch the row only; only a review
  // confirmation records a correction for the classifier.
  const updateTransactionCategory = useUpdateTransactionCategory()
  // The table checkbox clears the new-row highlight on one classification.
  const markSeen = useMarkTransactionSeen()

  const confirmReview = (categoryId: string, groupKey: string) => {
    if (!currentReviewRaw) return
    const nextId = reviewIdAfter(currentReviewRaw.id)
    setActiveReviewId(nextId)
    setSelectedId(nextId)
    correct.mutate({
      transactionId: currentReviewRaw.id,
      categoryId,
      // Keep the flag the classifier stored for the row; the review UI no
      // longer exposes it.
      isExpense:
        currentReviewRaw.classification?.is_expense ??
        transactionDirection(currentReviewRaw) === 'out',
      groupKey,
    })
  }

  const updateCategory = (
    transactionId: string,
    categoryId: string,
    groupKey: string,
  ) => {
    // The row may live on a page that has not been fetched (or opened from a
    // category's expanded list), so fall back to the selection override.
    const transaction =
      rawTransactions.find((t) => t.id === transactionId) ??
      (selectedOverride?.id === transactionId ? selectedOverride : undefined)
    if (!transaction) return

    // Keep the row's stored expense flag so a re-categorised fee stays a fee.
    const isExpense =
      transaction.classification?.is_expense ??
      transactionDirection(transaction) === 'out'

    // A correction clears needs_review, so advance the panel when the row
    // being edited is the one currently under review.
    if (currentReviewRaw?.id === transactionId) {
      const nextId = reviewIdAfter(transactionId)
      setActiveReviewId(nextId)
      setSelectedId(nextId)
    }

    updateTransactionCategory.mutate({
      transactionId,
      categoryId,
      isExpense,
      groupKey,
    })
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

  // Review rows can live on a page that has not been fetched yet. When the
  // loaded queue runs dry but the statement still has rows to review, pull the
  // next page so the review flow keeps going.
  const fetchNextPage = transactionsQuery.fetchNextPage
  const hasNextPage = transactionsQuery.hasNextPage
  const isFetchingNextPage = transactionsQuery.isFetchingNextPage
  useEffect(() => {
    if (reviewQueue.length > 0 || reviewCount === 0) return
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [
    reviewQueue.length,
    reviewCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  // The review filter only exists while the queue has rows, so fall back to
  // "All" rather than leaving an active filter that no longer has a tab.
  useEffect(() => {
    if (reviewCount === 0 && activeFilter === 'review') setActiveFilter('all')
  }, [reviewCount, activeFilter])

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const ingest = useIngestStatement()
  const {
    reset: resetIngest,
    cancel: cancelIngest,
    isPending: isIngestPending,
    isSuccess: isIngestSuccess,
  } = ingest

  const openUpload = () => {
    // Progress that is still running is shown as-is, and a success screen
    // that has not been acknowledged yet is shown again. Only an idle or
    // failed import starts from a clean slate.
    if (!isIngestPending && !isIngestSuccess) resetIngest()
    setCsvText('')
    setUploadOpen(true)
  }

  const uploadFile = (file: File) => {
    resetIngest()
    setUploadFileName(file.name)
    setUploadOpen(true)
    ingest.mutate({ kind: 'file', file })
  }

  const submitPaste = () => {
    const csv = csvText.trim()
    if (!csv) return
    resetIngest()
    setUploadFileName('pasted.csv')
    ingest.mutate({ kind: 'csv', csv })
  }

  // Closing the drawer is not a decision to stop: the classification loop
  // lives in this hook and keeps running while the user works elsewhere.
  const closeUpload = useCallback(() => {
    setUploadOpen(false)
    setCsvText('')
    if (!isIngestPending) resetIngest()
  }, [isIngestPending, resetIngest])

  // Only the explicit "Cancel import" button stops the loop.
  const cancelImport = useCallback(() => {
    cancelIngest()
    resetIngest()
    setUploadOpen(false)
    setCsvText('')
  }, [cancelIngest, resetIngest])

  // Everything is in: show the success state for a beat, then get out of the
  // way. The Done button short-circuits the wait.
  useEffect(() => {
    if (!uploadOpen || !isIngestSuccess) return
    const timer = window.setTimeout(closeUpload, SUCCESS_CLOSE_DELAY)
    return () => window.clearTimeout(timer)
  }, [uploadOpen, isIngestSuccess, closeUpload])

  const progress = ingest.progress

  const uploadSteps = useMemo<Array<UploadStep>>(() => {
    const isDone = ingest.isSuccess
    const { total, processed, needsReview } = progress

    return [
      {
        id: 'read',
        title: 'Read statement',
        description:
          total > 0 ? `${total} transactions found` : 'Reading the statement…',
        status: total > 0 || isDone ? 'done' : 'active',
      },
      {
        id: 'sort',
        title: 'Sorting into categories',
        description: 'Matching merchants to your categories',
        status: isDone ? 'done' : 'active',
        count: total > 0 ? `${processed} of ${total}` : undefined,
        progress: total > 0 ? Math.round((processed / total) * 100) : 0,
      },
      {
        id: 'review',
        title: 'Ready to review',
        description: "We'll flag anything we're unsure about",
        status: isDone ? 'done' : 'pending',
        count: isDone ? `${needsReview} to review` : undefined,
      },
    ]
  }, [ingest.isSuccess, progress])

  const sorted = useMemo<Array<SortedTransaction>>(
    () => progress.rows,
    [progress.rows],
  )

  const fileRange = useMemo(() => {
    if (progress.from && progress.to) {
      return `${format(new Date(progress.from), 'd MMM')} to ${format(
        new Date(progress.to),
        'd MMM yyyy',
      )}`
    }
    return uploadFileName ? 'Reading statement…' : ''
  }, [progress.from, progress.to, uploadFileName])

  const uploadStatus: UploadDrawerStatus = ingest.isSuccess
    ? 'success'
    : ingest.isPending
      ? 'importing'
      : 'idle'

  const uploadSummary: UploadSummary | undefined = ingest.data
    ? {
        // A resumed import stored nothing; its work is the rows it classified.
        processed: ingest.data.stored || ingest.data.processed,
        classified: ingest.data.classified,
        needsReview: ingest.data.needsReview,
        failed: ingest.data.failed,
        parseSkipped: ingest.data.parseSkipped,
      }
    : undefined

  const budget = budgetQuery.data
  const preference = budget?.preferences ?? null
  const currentBalance = budget?.current_balance
    ? Number.parseFloat(budget.current_balance)
    : null
  const salaryAmount = budget?.salary_amount
    ? Number.parseFloat(budget.salary_amount)
    : null
  const spentAmount = budget?.spent_amount
    ? Number.parseFloat(budget.spent_amount)
    : null
  const spentPercentage =
    salaryAmount && salaryAmount > 0 && spentAmount !== null
      ? (spentAmount / salaryAmount) * 100
      : 0
  const daysLeft = preference
    ? differenceInCalendarDays(parseISO(preference.end_date), new Date())
    : undefined
  const budgetName = preference
    ? formatBudgetWindow(preference.start_date, preference.end_date)
    : 'Set up a budget period'
  // The card heading names the period; the date range stays the editable
  // sub-line in the card body.
  const budgetMonth = preference
    ? formatBudgetMonth(preference.start_date, preference.end_date)
    : undefined

  return {
    user: { name: me.data.name },
    transactions,
    filteredTransactions,
    filters,
    activeFilter,
    onFilterChange: setActiveFilter,
    search,
    onSearchChange: setSearch,
    totalCount,
    reviewCount,
    categoryLabels,
    selectedId: selectedId ?? currentReviewRaw?.id ?? null,
    onSelect: selectTransaction,
    onToggleSeen: (transactionId: string) => markSeen.mutate(transactionId),
    currentReview,
    currentReviewIndex,
    reviewTotal: reviewCount,
    selectedTransaction,
    showSelectedDetails,
    categoryOptions,
    onCategoryChange: updateCategory,
    confirmReview,
    skipReview,
    onPrevReview: () => moveReview(-1),
    onNextReview: () => moveReview(1),
    hasMoreTransactions: transactionsQuery.hasNextPage,
    isLoadingMoreTransactions: transactionsQuery.isFetchingNextPage,
    onLoadMoreTransactions: () => void transactionsQuery.fetchNextPage(),
    dashboardView,
    onDashboardViewChange: setDashboardView,
    categoryBudgets: {
      overview: categoryBudgetsQuery.data,
      isLoading: categoryBudgetsQuery.isLoading,
      isSaving: setCategoryBudget.isPending || updateCategoryBudget.isPending,
      onSetBudget: (category: CategoryBudgetCategory, amount: number) => {
        if (category.category_budget_id) {
          updateCategoryBudget.mutate({
            categoryBudgetId: category.category_budget_id,
            amount,
          })
          return
        }
        setCategoryBudget.mutate({ categoryId: category.id, amount })
      },
      onDeleteBudget: (category: CategoryBudgetCategory) => {
        if (!category.category_budget_id) return
        deleteCategoryBudget.mutate(category.category_budget_id)
      },
    },
    onSelectTransactionFromCategory: (transaction: ApiStatementTransaction) =>
      selectTransaction(transaction.id, transaction),
    budget: {
      budgetName,
      budgetMonth,
      configured: Boolean(preference),
      currentAmount: getPrivacyDisplayValue(
        currentBalance === null ? '—' : formatCurrency(currentBalance, 'za'),
        isPrivacyEnabled,
      ),
      startingAmount: getPrivacyDisplayValue(
        salaryAmount === null ? '—' : formatCurrency(salaryAmount, 'za'),
        isPrivacyEnabled,
      ),
      spentAmount: getPrivacyDisplayValue(
        spentAmount === null ? '—' : formatCurrency(spentAmount, 'za'),
        isPrivacyEnabled,
      ),
      spentPercentage,
      daysLeft,
      onEdit: () => setBudgetDialogOpen(true),
      onTogglePrivacy: togglePrivacy,
    },
    budgetDialog: {
      open: budgetDialogOpen,
      onOpenChange: setBudgetDialogOpen,
      preferences: preference,
      accounts: budget?.accounts ?? [],
      isSaving: updateBudgetPreferences.isPending,
      onSubmit: (input: BudgetPeriodInput) => {
        updateBudgetPreferences.mutate(input, {
          onSuccess: () => setBudgetDialogOpen(false),
        })
      },
    },
    upload: {
      open: uploadOpen,
      openDrawer: openUpload,
      status: uploadStatus,
      fileName: uploadFileName,
      fileRange,
      csvText,
      onCsvTextChange: setCsvText,
      onPasteSubmit: submitPaste,
      onFile: uploadFile,
      steps: uploadSteps,
      sorted,
      summary: uploadSummary,
      close: closeUpload,
      onCancel: cancelImport,
    },
  }
}
