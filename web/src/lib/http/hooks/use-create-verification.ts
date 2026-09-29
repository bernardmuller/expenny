import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, errAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'

type CreateVerificationSuccess =
  paths['/verifications']['post']['responses']['201']['content']['application/json']

type CreateVerificationError = {
  error: string
  message: string
  code: string
}

export function useCreateVerification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.verifications.create(),
    mutationFn: async (): Promise<
      Result<CreateVerificationSuccess, CreateVerificationError>
    > =>
      withSession(
        () => {
          const userIdResult = getUserIdFromAccessToken()

          if (userIdResult.isErr()) {
            toast.error('Unable to get user information')
            console.log('error')
            return errAsync({
              error: 'Unauthorized',
              message: 'Unable to get user information',
              code: 'MISSING_USER_ID',
            })
          }
          const userId = userIdResult.value

          return toResult(
            client.POST('/verifications', {
              body: {
                value: userId,
              },
            }),
          )
            .andThen((data) => {
              toast.success('Penny Bot link ready — open Telegram to finish.')
              queryClient.invalidateQueries({
                queryKey: queryKeys.verifications.byValue(userId),
              })
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to create verification')
              return error
            })
        },
        (): CreateVerificationError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),
  })
}
