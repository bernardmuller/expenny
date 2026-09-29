import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import { withSession } from '../with-token'
import type { paths } from '../schema'

type CategoriesSuccess =
  paths['/categories']['get']['responses']['200']['content']['application/json']

type CategoriesError = {
  error: string
  message: string
  code: string
}

async function fetchCategories(): Promise<CategoriesSuccess> {
  const result = await withSession(
    () => {
      return toResult(
        client.GET('/categories', {
          params: {},
        }),
      )
    },
    (): CategoriesError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to get user categories')
      throw error
    },
  )
}

export function getCategoriesQueryOptions() {
  return {
    queryKey: queryKeys.categories.all,
    queryFn: fetchCategories,
    staleTime: 60 * 60 * 1000 * 24 * 30, // 30 days
  }
}
