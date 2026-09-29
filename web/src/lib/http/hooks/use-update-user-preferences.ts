import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, errAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'

type UpdateUserPreferencesBody = NonNullable<
  paths['/users/{id}/preferences']['patch']['requestBody']
>['content']['application/json']

type UpdateUserPreferencesSuccess =
  paths['/users/{id}/preferences']['patch']['responses']['200']['content']['application/json']

type UpdateUserPreferencesError = {
  error: string
  message: string
  code: string
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['update-user-preferences'],
    mutationFn: async (
      body: UpdateUserPreferencesBody,
    ): Promise<
      Result<UpdateUserPreferencesSuccess, UpdateUserPreferencesError>
    > =>
      withSession(
        () => {
          const userIdResult = getUserIdFromAccessToken()

          if (userIdResult.isErr()) {
            toast.error('Unable to get user information')
            return errAsync({
              error: 'Unauthorized',
              message: 'Unable to get user information',
              code: 'MISSING_USER_ID',
            })
          }

          const userId = userIdResult.value

          return toResult(
            client.PATCH('/users/{id}/preferences', {
              params: {
                path: { id: userId },
              },
              body,
            }),
          )
            .andThen((data) => {
              toast.success('Preferences updated successfully')
              queryClient.invalidateQueries({
                queryKey: queryKeys.users.preferences,
              })
              // Also invalidate budgets/categories as start date might affect them?
              // Maybe not strictly necessary for this task but good practice if preferences affect calculations.
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to update preferences')
              return error
            })
        },
        (): UpdateUserPreferencesError => ({
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
