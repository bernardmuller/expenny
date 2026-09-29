import { toast } from 'sonner'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import { withSession } from '../../with-token'
import type { paths } from '../../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

type VerificationsSuccess =
  paths['/verifications']['get']['responses']['200']['content']['application/json']

type Verification = VerificationsSuccess['verifications'][number]

type VerificationsError = {
  error: string
  message: string
  code: string
}

async function fetchVerificationByValue(
  value: string,
): Promise<Verification | null> {
  const result = await withSession(
    () => {
      return toResult(
        client.GET('/verifications', {
          params: { query: { value } },
        }),
      )
    },
    (): VerificationsError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data.verifications[0] ?? null,
    (error) => {
      throw error
    },
  )
}

export function getVerificationByValueQueryOptions(value: string) {
  return {
    queryKey: queryKeys.verifications.byValue(value),
    queryFn: () => fetchVerificationByValue(value),
  }
}

function getCurrentUserVerificationQueryOptions() {
  const userIdResult = getUserIdFromAccessToken()

  if (userIdResult.isErr()) {
    toast.error('Unable to get user information')
    throw new Error('Unable to get user information')
  }

  return getVerificationByValueQueryOptions(userIdResult.value)
}
