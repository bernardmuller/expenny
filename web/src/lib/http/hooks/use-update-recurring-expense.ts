import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import type { UserRecurringExpensesSuccess } from '../queries/recurring-expenses/getUserRecurringExpenses'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'

type UpdateRecurringExpenseBody = NonNullable<
  paths['/recurring-expenses/{templateId}']['patch']['requestBody']
>['content']['application/json']

type UpdateRecurringExpenseSuccess =
  paths['/recurring-expenses/{templateId}']['patch']['responses']['200']['content']['application/json']

type UpdateRecurringExpenseError = {
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

export function useUpdateRecurringExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.recurringExpenses.update(),
    mutationFn: async (input: {
      templateId: string
      body: UpdateRecurringExpenseBody
    }): Promise<
      Result<UpdateRecurringExpenseSuccess, UpdateRecurringExpenseError>
    > =>
      withSession(
        () =>
          toResult(
            client.PATCH('/recurring-expenses/{templateId}', {
              params: { path: { templateId: input.templateId } },
              body: input.body,
            }),
          )
            .andThen((data) => {
              toast.success('Recurring expense updated')
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to update recurring expense')
              return error
            }),
        (): UpdateRecurringExpenseError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),

    onMutate: async ({ templateId, body }): Promise<MutationContext> => {
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isErr()) return undefined
      const queryKey = queryKeys.recurringExpenses.byUser(userIdResult.value)

      await queryClient.cancelQueries({ queryKey })
      const previous =
        queryClient.getQueryData<UserRecurringExpensesSuccess>(queryKey)

      queryClient.setQueryData<UserRecurringExpensesSuccess>(
        queryKey,
        (old) => {
          if (!old) return old
          return {
            ...old,
            templates: old.templates.map((t) =>
              t.id === templateId
                ? {
                    ...t,
                    ...(body.description !== undefined && {
                      description: body.description,
                    }),
                    ...(body.amount !== undefined && {
                      amount: body.amount.toString(),
                    }),
                    ...(body.categoryId !== undefined && {
                      categoryId: body.categoryId,
                    }),
                    ...(body.scheduledAt !== undefined && {
                      scheduledAt: body.scheduledAt,
                    }),
                    updatedAt: new Date().toISOString(),
                  }
                : t,
            ),
          }
        },
      )

      return { queryKey, previous }
    },

    onError: (_e, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(context.queryKey, context.previous)
    },

    onSettled: (_data, _e, _vars, context) => {
      if (context) queryClient.invalidateQueries({ queryKey: context.queryKey })
    },
  })
}
