import { useMutation } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, errAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'

type OnboardRequestBody =
  // @ts-ignore: content does exist
  paths['/users/{id}/onboard']['post']['requestBody']['content']['application/json']

type OnboardRequestSuccess =
  paths['/users/{id}/onboard']['post']['responses']['200']['content']['application/json']

type OnboardRequestError =
  | paths['/users/{id}/onboard']['post']['responses']['409']['content']['application/json']
  | paths['/users/{id}/onboard']['post']['responses']['500']['content']['application/json']

export function useOnboardRequest() {
  return useMutation({
    mutationKey: queryKeys.users.onboard(),
    mutationFn: async (
      body: OnboardRequestBody,
    ): Promise<Result<OnboardRequestSuccess, OnboardRequestError>> =>
      withSession(
        () => {
          const userIdResult = getUserIdFromAccessToken()

          if (userIdResult.isErr()) {
            toast.error('Unable to get user information')
            return errAsync({
              error: 'Unauthorized',
              message: 'Unable to get user information',
              code: 'MISSING_USER_ID',
            } as OnboardRequestError)
          }

          const userId = userIdResult.value

          return toResult(
            client.POST('/users/{id}/onboard', {
              params: {
                path: { id: userId },
              },
              body,
            }),
          )
            .andThen((data) => {
              toast.success('Onboarding completed successfully!')
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to complete onboarding')
              return error
            })
        },
        (): OnboardRequestError => ({
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
