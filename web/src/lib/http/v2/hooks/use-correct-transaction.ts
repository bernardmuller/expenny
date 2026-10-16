import { queryKeys } from '../../query-keys'
import { useTransactionCategoryMutation } from './use-transaction-category'
import type { TransactionCategoryVariables } from './use-transaction-category'

export type CorrectTransactionVariables = TransactionCategoryVariables

/**
 * Records a human decision from the review panel. The API keeps it in the
 * corrections table, which is the classifier's memory of the merchant, and
 * replaces the row's classification so it leaves the review queue.
 */
export function useCorrectTransaction() {
  return useTransactionCategoryMutation({
    path: (transactionId) =>
      `/v2/statements/transactions/${transactionId}/correction`,
    method: 'POST',
    mutationKey: queryKeys.statements.correct(),
    successMessage: 'Category saved',
    failureMessage: 'Failed to save the correction',
  })
}
