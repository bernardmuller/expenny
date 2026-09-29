import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, errAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import type { UserRecurringExpensesSuccess } from '../queries/recurring-expenses/getUserRecurringExpenses'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'

type CreateRecurringExpenseBody = NonNullable<
  paths['/users/{userId}/recurring-expenses']['post']['requestBody']
>['content']['application/json']

type CreateRecurringExpenseSuccess =
  paths['/users/{userId}/recurring-expenses']['post']['responses']['201']['content']['application/json']

type CreateRecurringExpenseError = {
  error: string
  message: string
  code: string
}

type MutationContext =
  | {
      queryKey: readonly unknown[]
      previous: UserRecurringExpensesSuccess | undefined
    }
  | undefined

export function useCreateRecurringExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.recurringExpenses.create(),
    mutationFn: async (
      body: CreateRecurringExpenseBody,
    ): Promise<
      Result<CreateRecurringExpenseSuccess, CreateRecurringExpenseError>
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
            client.POST('/users/{userId}/recurring-expenses', {
              params: { path: { userId } },
              body,
            }),
          )
            .andThen((data) => {
              toast.success('Recurring expense created')
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to create recurring expense')
              return error
            })
        },
        (): CreateRecurringExpenseError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),

    onMutate: async (body): Promise<MutationContext> => {
      console.log(body)
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isErr()) return undefined
      const userId = userIdResult.value
      const queryKey = queryKeys.recurringExpenses.byUser(userId)

      await queryClient.cancelQueries({ queryKey })
      const previous =
        queryClient.getQueryData<UserRecurringExpensesSuccess>(queryKey)

      const now = new Date().toISOString()
      const optimistic: UserRecurringExpensesSuccess['templates'][number] = {
        id: '00000000-0000-0000-0000-000000000000',
        userId,
        description: body.description,
        amount: body.amount.toString(),
        categoryId: body.categoryId,
        scheduledAt: body.scheduledAt,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }

      queryClient.setQueryData<UserRecurringExpensesSuccess>(queryKey, (old) =>
        old ? { ...old, templates: [...old.templates, optimistic] } : old,
      )

      return { queryKey, previous }
    },

    onError: (_e, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(context.queryKey, context.previous)
    },

    onSettled: (_data, _e, _vars, context) => {
      if (context) queryClient.invalidateQueries({ queryKey: context.queryKey })
      queryClient.invalidateQueries({
        queryKey: queryKeys.notificationPreferences.all,
      })
    },
  })
}
