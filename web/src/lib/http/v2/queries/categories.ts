import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import type { StatementCategoriesResponse } from '../types'

async function fetchStatementCategories(): Promise<StatementCategoriesResponse> {
  try {
    return await apiFetch<StatementCategoriesResponse>('/v2/categories')
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load categories',
    )
    throw error
  }
}

export function getStatementCategoriesQueryOptions() {
  return {
    queryKey: queryKeys.statements.categories,
    queryFn: fetchStatementCategories,
    staleTime: 60 * 60 * 1000,
  }
}
