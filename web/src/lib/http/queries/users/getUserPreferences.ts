import { toast } from 'sonner'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import { withSession } from '../../with-token'
import type { paths } from '../../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

type UserPreferencesSuccess =
  paths['/users/{id}/preferences']['get']['responses']['200']['content']['application/json']

type UserPreferencesError = {
  error: string
  message: string
  code: string
}

async function getUserPreferences(): Promise<UserPreferencesSuccess> {
  const userIdResult = getUserIdFromAccessToken()

  if (userIdResult.isErr()) {
    toast.error('Unable to get user information')
    throw new Error('Unable to get user information')
  }

  const userId = userIdResult.value

  const result = await withSession(
    () => {
      return toResult(
        client.GET('/users/{id}/preferences', {
          params: {
            path: { id: userId },
          },
        }),
      )
    },
    (): UserPreferencesError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      throw error
    },
  )
}

export function getUserPreferencesQueryOptions() {
  return {
    queryKey: queryKeys.users.preferences,
    queryFn: getUserPreferences,
  }
}
