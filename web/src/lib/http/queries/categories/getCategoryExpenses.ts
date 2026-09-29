import { toast } from 'sonner'
import { withSession } from '../../with-token'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import type { paths } from '../../schema'

export type CategoryExpensesSuccess =
  paths['/categories/{categoryId}/expenses']['get']['responses']['200']['content']['application/json']

type CategoryExpensesError =
  | paths['/categories/{categoryId}/expenses']['get']['responses']['404']['content']['application/json']
  | paths['/categories/{categoryId}/expenses']['get']['responses']['401']['content']['application/json']

export interface CategoryExpensesOptions {
  limit?: number
  offset?: number
  sort?: 'createdAt' | '-createdAt'
}

async function fetchCategoryExpenses(
  categoryId: string,
  options?: CategoryExpensesOptions,
): Promise<CategoryExpensesSuccess> {
  const result = await withSession(
    () => {
      return toResult(
        client.GET('/categories/{categoryId}/expenses', {
          params: {
            path: { categoryId },
            query: options
              ? {
                  limit: options.limit,
                  offset: options.offset,
                  sort: options.sort,
                }
              : undefined,
          },
        }),
      )
    },
    (): CategoryExpensesError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to get category expenses')
      throw error
    },
  )
}

export function getCategoryExpensesQueryOptions(
  categoryId: string,
  options?: CategoryExpensesOptions,
) {
  return {
    queryKey: queryKeys.categories.expenses(categoryId, options),
    queryFn: () => fetchCategoryExpenses(categoryId, options),
  }
}
