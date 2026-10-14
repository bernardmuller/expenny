import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import type { StatementTransactionsResponse } from '../types'

async function fetchStatementTransactions(): Promise<StatementTransactionsResponse> {
  try {
    return await apiFetch<StatementTransactionsResponse>(
      '/v2/statements/transactions',
    )
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load transactions',
    )
    throw error
  }
}

export function getStatementTransactionsQueryOptions() {
  return {
    queryKey: queryKeys.statements.transactions,
    queryFn: fetchStatementTransactions,
  }
}
