import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { queryKeys } from '../query-keys'
import type {
  BudgetPreferences,
  BudgetResponse,
  CategoryBudgetCategory,
  CategoryBudgetOverview,
  CategoryGroupsResponse,
  Correction,
  CorrectionsResponse,
  StatementCategoriesResponse,
  StatementCategory,
  StatementCategoryGroup,
  StatementTransaction,
  StatementTransactionsResponse,
} from './types'

/* -------------------------------------------------------------------------- */
/* Invalidation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Everything the dashboard renders comes off the statements caches, so any
 * write that can move a number or a label has to invalidate all of them. The
 * `categoryBudgets` key is a prefix: the per-category transaction lists live
 * underneath it and are invalidated with it.
 */
export function invalidateStatementData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.statements.transactions,
  })
  void queryClient.invalidateQueries({ queryKey: queryKeys.budget })
  void queryClient.invalidateQueries({ queryKey: queryKeys.categoryBudgets })
}

/**
 * Category and group writes also touch every transaction and budget response,
 * because both embed the category label and icon.
 */
export function invalidateCategoryData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.statements.categories,
  })
  void queryClient.invalidateQueries({ queryKey: queryKeys.categoryGroups })
  invalidateStatementData(queryClient)
}

/* -------------------------------------------------------------------------- */
/* Optimistic reducers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A temporary id for an optimistic row. It only has to survive until the
 * mutation answers and the related caches are invalidated, so randomness is
 * enough. `crypto.randomUUID` is avoided because it is missing on plain-HTTP
 * LAN origins.
 */
export function optimisticId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export type TransactionCorrection = {
  category: StatementCategory | null
  isExpense: boolean
  groupKey: string
}

/** One row with a human decision applied. */
function correctedTransaction(
  transaction: StatementTransaction,
  correction: TransactionCorrection,
): StatementTransaction {
  return {
    ...transaction,
    needs_review: false,
    classification: {
      id: transaction.classification?.id ?? `optimistic-${transaction.id}`,
      category: correction.category,
      is_expense: correction.isExpense,
      expense_prob:
        transaction.classification?.expense_prob ??
        (correction.isExpense ? 1 : 0),
      confidence: 1,
      source: 'human',
      group: correction.groupKey,
      classified_at: new Date().toISOString(),
    },
  }
}

/**
 * Applies a human decision to one row and drops it out of the review queue.
 * The review counter only moves when the row was actually waiting on a human.
 */
export function applyTransactionCorrection(
  data: InfiniteData<StatementTransactionsResponse> | undefined,
  transactionId: string,
  correction: TransactionCorrection,
): InfiniteData<StatementTransactionsResponse> | undefined {
  if (!data) return data

  const target = data.pages
    .flatMap((page) => page.transactions)
    .find((transaction) => transaction.id === transactionId)
  if (!target) return data
  const clearsReview = target.needs_review

  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      review_count:
        clearsReview && index === 0
          ? Math.max(0, page.review_count - 1)
          : page.review_count,
      transactions: page.transactions.map((transaction) =>
        transaction.id === transactionId
          ? correctedTransaction(transaction, correction)
          : transaction,
      ),
    })),
  }
}

/**
 * The details panel can show a row that is not in the paginated cache (an
 * expanded category, for example), so its snapshot is patched in step with it.
 */
export function applySelectionCorrection(
  selection: StatementTransaction | null | undefined,
  transactionId: string,
  correction: TransactionCorrection,
): StatementTransaction | null | undefined {
  if (!selection || selection.id !== transactionId) return selection
  return correctedTransaction(selection, correction)
}

/**
 * Sets (or clears) the allocation on one category. The row is matched by
 * category id when creating and by budget id when updating or deleting.
 */
export function applyCategoryAllocation(
  overview: CategoryBudgetOverview | undefined,
  match: { categoryId?: string; categoryBudgetId?: string },
  next: { allocated: string | null; categoryBudgetId: string | null },
): CategoryBudgetOverview | undefined {
  if (!overview) return overview

  const matches = (category: CategoryBudgetCategory) =>
    (match.categoryId != null && category.id === match.categoryId) ||
    (match.categoryBudgetId != null &&
      category.category_budget_id === match.categoryBudgetId)

  return {
    ...overview,
    groups: overview.groups.map((group) => ({
      ...group,
      categories: group.categories.map((category) =>
        matches(category)
          ? {
              ...category,
              allocated: next.allocated,
              category_budget_id: next.categoryBudgetId,
            }
          : category,
      ),
    })),
  }
}

/** Moves the budget card to the new window before the server answers. */
export function applyBudgetPreferences(
  budget: BudgetResponse | undefined,
  preferences: BudgetPreferences,
): BudgetResponse | undefined {
  if (!budget) return budget
  return { ...budget, preferences }
}

export function applyCategoryCreated(
  data: StatementCategoriesResponse | undefined,
  category: StatementCategory,
): StatementCategoriesResponse | undefined {
  if (!data) return data
  return { ...data, categories: [...data.categories, category] }
}

export function applyCategoryUpdated(
  data: StatementCategoriesResponse | undefined,
  patch: StatementCategory,
): StatementCategoriesResponse | undefined {
  if (!data) return data
  return {
    ...data,
    categories: data.categories.map((category) =>
      category.id === patch.id ? { ...category, ...patch } : category,
    ),
  }
}

export function applyCategoryRemoved(
  data: StatementCategoriesResponse | undefined,
  categoryId: string,
): StatementCategoriesResponse | undefined {
  if (!data) return data
  return {
    ...data,
    categories: data.categories.filter(
      (category) => category.id !== categoryId,
    ),
  }
}

/** Group writes also flow into the memberships nested on every category. */
export function applyGroupPatchedToCategories(
  data: StatementCategoriesResponse | undefined,
  group: StatementCategoryGroup,
): StatementCategoriesResponse | undefined {
  if (!data) return data
  return {
    ...data,
    categories: data.categories.map((category) => ({
      ...category,
      groups: category.groups?.map((candidate) =>
        candidate.id === group.id ? { ...candidate, ...group } : candidate,
      ),
    })),
  }
}

export function applyGroupRemovedFromCategories(
  data: StatementCategoriesResponse | undefined,
  groupId: string,
): StatementCategoriesResponse | undefined {
  if (!data) return data
  return {
    ...data,
    categories: data.categories.map((category) => ({
      ...category,
      groups: category.groups?.filter((group) => group.id !== groupId),
    })),
  }
}

export function applyCategoryGroupCreated(
  data: CategoryGroupsResponse | undefined,
  group: StatementCategoryGroup,
): CategoryGroupsResponse | undefined {
  if (!data) return data
  return { ...data, groups: [...data.groups, group] }
}

export function applyCategoryGroupUpdated(
  data: CategoryGroupsResponse | undefined,
  patch: StatementCategoryGroup,
): CategoryGroupsResponse | undefined {
  if (!data) return data
  return {
    ...data,
    groups: data.groups.map((group) =>
      group.id === patch.id ? { ...group, ...patch } : group,
    ),
  }
}

export function applyCategoryGroupRemoved(
  data: CategoryGroupsResponse | undefined,
  groupId: string,
): CategoryGroupsResponse | undefined {
  if (!data) return data
  return {
    ...data,
    groups: data.groups.filter((group) => group.id !== groupId),
  }
}

export function applyCorrectionCreated(
  data: CorrectionsResponse | undefined,
  correction: Correction,
): CorrectionsResponse | undefined {
  if (!data) return data
  return { ...data, corrections: [...data.corrections, correction] }
}

export function applyCorrectionUpdated(
  data: CorrectionsResponse | undefined,
  patch: Partial<Correction> & { id: string },
): CorrectionsResponse | undefined {
  if (!data) return data
  return {
    ...data,
    corrections: data.corrections.map((candidate) =>
      candidate.id === patch.id ? { ...candidate, ...patch } : candidate,
    ),
  }
}

export function applyCorrectionRemoved(
  data: CorrectionsResponse | undefined,
  correctionId: string,
): CorrectionsResponse | undefined {
  if (!data) return data
  return {
    ...data,
    corrections: data.corrections.filter(
      (correction) => correction.id !== correctionId,
    ),
  }
}
