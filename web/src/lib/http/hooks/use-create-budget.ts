import { useMutation } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, errAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'

type CreateBudgetRequestBody =
  // @ts-ignore: content does exist
  paths['/users/{id}/budgets']['post']['requestBody']['content']['application/json']

type CreateBudgetRequestSuccess =
  paths['/users/{id}/budgets']['post']['responses']['200']['content']['application/json']

type CreateBudgetRequestError =
  | paths['/users/{id}/budgets']['post']['responses']['404']['content']['application/json']
  | paths['/users/{id}/budgets']['post']['responses']['500']['content']['application/json']

export function useCreateBudget() {
  return useMutation({
    mutationKey: queryKeys.budgets.create(),
    mutationFn: async (
      body: CreateBudgetRequestBody,
    ): Promise<Result<CreateBudgetRequestSuccess, CreateBudgetRequestError>> =>
      withSession(
        () => {
          const userIdResult = getUserIdFromAccessToken()

          if (userIdResult.isErr()) {
            toast.error('Unable to get user information')
            return errAsync({
              error: 'Unauthorized',
              message: 'Unable to get user information',
              code: 'MISSING_USER_ID',
            } as CreateBudgetRequestError)
          }

          const userId = userIdResult.value

          return toResult(
            client.POST('/users/{id}/budgets', {
              params: {
                path: { id: userId },
              },
              body,
            }),
          )
            .andThen((data) => {
              toast.success('Budget created successfully!')
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to create budget')
              return error
            })
        },
        (): CreateBudgetRequestError => ({
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
