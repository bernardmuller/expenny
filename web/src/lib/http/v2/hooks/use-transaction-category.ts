import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import {
  applySelectionCorrection,
  applyTransactionCorrection,
  invalidateStatementData,
} from '../cache'
import type {
  StatementCategoriesResponse,
  StatementTransaction,
  StatementTransactionsResponse,
} from '../types'

export type TransactionCategoryVariables = {
  transactionId: string
  categoryId: string
  isExpense: boolean
  groupKey: string
}

type TransactionCategoryMutationOptions = {
  /** Endpoint the decision is written to, minus the transaction id. */
  path: (transactionId: string) => string
  method: 'POST' | 'PATCH'
  mutationKey: ReadonlyArray<unknown>
  successMessage: string
  failureMessage: string
}

/**
 * Shared plumbing for the two ways a human sets a row's category: the review
 * panel (which also records a correction for the classifier) and the one-off
 * edits in the table and details panel (which do not). Both patch the row, its
 * details-panel snapshot and the review counters optimistically, then refetch
 * the statement-derived caches.
 */
export function useTransactionCategoryMutation({
  path,
  method,
  mutationKey,
  successMessage,
  failureMessage,
}: TransactionCategoryMutationOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey,
    mutationFn: (variables: TransactionCategoryVariables) =>
      apiFetch<unknown>(path(variables.transactionId), {
        method,
        body: {
          category_id: variables.categoryId,
          is_expense: variables.isExpense,
          group_key: variables.groupKey,
        },
      }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.statements.transactions,
      })

      const previous = queryClient.getQueryData<
        InfiniteData<StatementTransactionsResponse>
      >(queryKeys.statements.transactions)
      const previousSelection =
        queryClient.getQueryData<StatementTransaction | null>(
          queryKeys.statements.selection,
        )
      const categories = queryClient.getQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
      )
      const category =
        categories?.categories.find((c) => c.id === variables.categoryId) ??
        null
      const correction = {
        category,
        isExpense: variables.isExpense,
        groupKey: variables.groupKey,
      }

      // Drop the row out of the review queue and show the new category
      // immediately.
      queryClient.setQueryData<InfiniteData<StatementTransactionsResponse>>(
        queryKeys.statements.transactions,
        (old) =>
          applyTransactionCorrection(old, variables.transactionId, correction),
      )
      // The details panel can show a row the paginated cache does not hold
      // (an expanded category row), so its snapshot moves in step.
      queryClient.setQueryData<StatementTransaction | null>(
        queryKeys.statements.selection,
        (old) =>
          applySelectionCorrection(old, variables.transactionId, correction),
      )

      return { previous, previousSelection }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.statements.transactions,
          context.previous,
        )
      }
      if (context?.previousSelection !== undefined) {
        queryClient.setQueryData(
          queryKeys.statements.selection,
          context.previousSelection,
        )
      }
      toast.error(error.message || failureMessage)
    },
    onSuccess: () => {
      toast.success(successMessage)
      // The optimistic patch only knows this row. Refetch so the review
      // counts, the budget spend and the per-category lists all agree.
      invalidateStatementData(queryClient)
    },
  })
}
