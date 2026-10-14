import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import type {
  CorrectTransactionResponse,
  StatementCategoriesResponse,
  StatementTransactionsResponse,
} from '../types'

export type CorrectTransactionVariables = {
  transactionId: string
  categoryId: string
  isExpense: boolean
}

export function useCorrectTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.statements.correct(),
    mutationFn: (variables: CorrectTransactionVariables) =>
      apiFetch<CorrectTransactionResponse>(
        `/v2/statements/transactions/${variables.transactionId}/correction`,
        {
          method: 'POST',
          body: {
            category_id: variables.categoryId,
            is_expense: variables.isExpense,
          },
        },
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.statements.transactions,
      })

      const previous = queryClient.getQueryData<StatementTransactionsResponse>(
        queryKeys.statements.transactions,
      )
      const categories = queryClient.getQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
      )
      const category =
        categories?.categories.find((c) => c.id === variables.categoryId) ??
        null

      // Optimistically drop the row out of the review queue so the next
      // transaction slides into place immediately.
      queryClient.setQueryData<StatementTransactionsResponse>(
        queryKeys.statements.transactions,
        (old) => {
          if (!old) return old
          return {
            ...old,
            transactions: old.transactions.map((transaction) =>
              transaction.id === variables.transactionId
                ? {
                    ...transaction,
                    needs_review: false,
                    classification: {
                      id:
                        transaction.classification?.id ??
                        `optimistic-${transaction.id}`,
                      category,
                      is_expense: variables.isExpense,
                      expense_prob:
                        transaction.classification?.expense_prob ??
                        (variables.isExpense ? 1 : 0),
                      confidence: 1,
                      source: 'human',
                      classified_at: new Date().toISOString(),
                    },
                  }
                : transaction,
            ),
          }
        },
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.statements.transactions,
          context.previous,
        )
      }
      toast.error('Failed to save the correction')
    },
    onSuccess: () => {
      toast.success('Category saved')
      queryClient.invalidateQueries({
        queryKey: queryKeys.statements.transactions,
      })
    },
  })
}
