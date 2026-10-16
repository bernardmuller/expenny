import { queryKeys } from '../../query-keys'
import { useTransactionCategoryMutation } from './use-transaction-category'

/**
 * Changes the category of one transaction, and only that transaction. No
 * correction is recorded, so a merchant with the same description elsewhere is
 * unaffected and the classifier keeps classifying future rows the same way.
 * This backs the one-off edits in the table and the details panel; the review
 * panel is the surface that teaches the classifier.
 */
export function useUpdateTransactionCategory() {
  return useTransactionCategoryMutation({
    path: (transactionId) =>
      `/v2/statements/transactions/${transactionId}/category`,
    method: 'PATCH',
    mutationKey: queryKeys.statements.updateCategory(),
    successMessage: 'Category updated',
    failureMessage: 'Failed to update the category',
  })
}
