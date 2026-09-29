import { toast } from 'sonner'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import { withSession } from '../../with-token'
import type { paths } from '../../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

type UserSuccess =
  paths['/users/{id}']['get']['responses']['200']['content']['application/json']

type UserError = {
  error: string
  message: string
  code: string
}

async function getUserById(): Promise<UserSuccess> {
  const userIdResult = getUserIdFromAccessToken()

  if (userIdResult.isErr()) {
    toast.error('Unable to get user information')
    throw new Error('Unable to get user information')
  }

  const userId = userIdResult.value

  const result = await withSession(
    () => {
      return toResult(
        client.GET('/users/{id}', {
          params: {
            path: { id: userId },
          },
        }),
      )
    },
    (): UserError => ({
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

export function getUserByIdQueryOptions() {
  return {
    queryKey: queryKeys.users.current,
    queryFn: getUserById,
    staleTime: 60 * 60 * 1000,
  }
}
