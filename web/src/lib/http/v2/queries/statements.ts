import type { QueryFunctionContext } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import type { StatementTransactionsResponse } from '../types'

/** Transactions fetched per page. Scrolling the table loads the next page. */
export const STATEMENT_PAGE_SIZE = 20

async function fetchStatementTransactions(
  limit: number,
  offset: number,
): Promise<StatementTransactionsResponse> {
  try {
    return await apiFetch<StatementTransactionsResponse>(
      `/v2/statements/transactions?limit=${limit}&offset=${offset}`,
    )
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load transactions',
    )
    throw error
  }
}

export function getStatementTransactionsQueryOptions(
  limit: number = STATEMENT_PAGE_SIZE,
) {
  return {
    queryKey: queryKeys.statements.transactions,
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<ReadonlyArray<unknown>, number>) =>
      fetchStatementTransactions(limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage: StatementTransactionsResponse) =>
      lastPage.next_offset ?? undefined,
  }
}
