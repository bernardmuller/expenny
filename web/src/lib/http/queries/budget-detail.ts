import { toast } from 'sonner'
import { withSession } from '../with-token'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

export type BudgetDetailSuccess =
  paths['/budgets/{id}/with-relatives']['get']['responses']['200']['content']['application/json']

type BudgetDetailError =
  | paths['/budgets/{id}/with-relatives']['get']['responses']['404']['content']['application/json']
  | paths['/budgets/{id}/with-relatives']['get']['responses']['403']['content']['application/json']

async function fetchBudgetById(budgetId: string): Promise<BudgetDetailSuccess> {
  const userIdResult = getUserIdFromAccessToken()

  if (userIdResult.isErr()) {
    toast.error('Unable to get user information')
    throw new Error('Unable to get user information')
  }

  const result = await withSession(
    () => {
      return toResult(
        client.GET('/budgets/{id}/with-relatives', {
          params: {
            path: { id: budgetId },
          },
        }),
      )
    },
    (): BudgetDetailError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to get budget details')
      throw error
    },
  )
}

export function getBudgetByIdQueryOptions(budgetId: string) {
  return {
    queryKey: queryKeys.budgets.detail(budgetId),
    queryFn: () => fetchBudgetById(budgetId),
  }
}
