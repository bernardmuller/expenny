import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import { applySelectionSeen, applyTransactionSeen } from '../cache'
import type {
  MarkTransactionSeenResponse,
  StatementTransaction,
  StatementTransactionsResponse,
} from '../types'

/**
 * Ticks a classified row's checkbox: the server stamps seen_at and the
 * new-row highlight disappears. Only that row's caches are patched, so no
 * budget or review data has to be refetched.
 */
export function useMarkTransactionSeen() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.statements.markSeen(),
    mutationFn: (transactionId: string) =>
      apiFetch<MarkTransactionSeenResponse>(
        `/v2/statements/transactions/${transactionId}/seen`,
        { method: 'PATCH' },
      ),
    onMutate: async (transactionId) => {
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

      // Stamp optimistically; onSuccess swaps in the server's exact time.
      const seenAt = new Date().toISOString()
      queryClient.setQueryData<InfiniteData<StatementTransactionsResponse>>(
        queryKeys.statements.transactions,
        (old) => applyTransactionSeen(old, transactionId, seenAt),
      )
      queryClient.setQueryData<StatementTransaction | null>(
        queryKeys.statements.selection,
        (old) => applySelectionSeen(old, transactionId, seenAt),
      )

      return { previous, previousSelection }
    },
    onError: (error: Error, _transactionId, context) => {
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
      toast.error(error.message || 'Failed to mark the transaction as seen')
    },
    onSuccess: (data, transactionId) => {
      queryClient.setQueryData<InfiniteData<StatementTransactionsResponse>>(
        queryKeys.statements.transactions,
        (old) => applyTransactionSeen(old, transactionId, data.seen_at),
      )
      queryClient.setQueryData<StatementTransaction | null>(
        queryKeys.statements.selection,
        (old) => applySelectionSeen(old, transactionId, data.seen_at),
      )
    },
  })
}
