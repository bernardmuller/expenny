import { toast } from 'sonner'
import { withSession } from '../with-token'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

export type ActiveBudgetSuccess =
  paths['/users/{id}/budgets/active']['get']['responses']['200']['content']['application/json']

type ActiveBudgetError =
  paths['/users/{id}/budgets/active']['get']['responses']['404']['content']['application/json']

async function fetchActiveBudget(): Promise<ActiveBudgetSuccess> {
  const userIdResult = getUserIdFromAccessToken()

  if (userIdResult.isErr()) {
    toast.error('Unable to get user information')
    throw new Error('Unable to get user information')
  }

  const userId = userIdResult.value

  const result = await withSession(
    () => {
      return toResult(
        client.GET('/users/{id}/budgets/active', {
          params: {
            path: { id: userId },
          },
        }),
      )
    },
    (): ActiveBudgetError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      // toast.error(error.message || 'Failed to get active budget')
      throw error
    },
  )
}

export function getActiveBudgetQueryOptions() {
  const userIdResult = getUserIdFromAccessToken()

  return {
    queryKey: userIdResult.isOk()
      ? queryKeys.budgets.active(userIdResult.value)
      : ['budgets', 'active', 'unknown'],
    queryFn: fetchActiveBudget,
  }
}
