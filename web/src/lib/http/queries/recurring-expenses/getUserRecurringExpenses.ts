import { toast } from 'sonner'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import { withSession } from '../../with-token'
import type { paths } from '../../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

export type UserRecurringExpensesSuccess =
  paths['/users/{userId}/recurring-expenses']['get']['responses']['200']['content']['application/json']

export type RecurringExpenseTemplate =
  UserRecurringExpensesSuccess['templates'][number]

type UserRecurringExpensesError = {
  error: string
  message: string
  code: string
}

async function fetchUserRecurringExpenses(): Promise<UserRecurringExpensesSuccess> {
  const userIdResult = getUserIdFromAccessToken()

  if (userIdResult.isErr()) {
    toast.error('Unable to get user information')
    throw new Error('Unable to get user information')
  }

  const userId = userIdResult.value

  const result = await withSession(
    () => {
      return toResult(
        client.GET('/users/{userId}/recurring-expenses', {
          params: { path: { userId } },
        }),
      )
    },
    (): UserRecurringExpensesError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to load recurring expenses')
      throw error
    },
  )
}

export function getUserRecurringExpensesQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.recurringExpenses.byUser(userId),
    queryFn: fetchUserRecurringExpenses,
  }
}
