import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, ResultAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client } from '../client'
import { queryKeys } from '../query-keys'
import type { UserRecurringExpensesSuccess } from '../queries/recurring-expenses/getUserRecurringExpenses'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'

type DeleteRecurringExpenseError = {
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

export function useDeleteRecurringExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.recurringExpenses.delete(),
    mutationFn: async (input: {
      templateId: string
    }): Promise<Result<{ id: string }, DeleteRecurringExpenseError>> =>
      withSession(
        () =>
          ResultAsync.fromPromise(
            client.DELETE('/recurring-expenses/{templateId}', {
              params: { path: { templateId: input.templateId } },
            }),
            (e): DeleteRecurringExpenseError => ({
              error: 'NetworkError',
              message: String(e),
              code: 'NETWORK_ERROR',
            }),
          ).andThen(({ response, error: respError }) => {
            if (response.ok) {
              toast.success('Recurring expense deleted')
              return ok({ id: input.templateId })
            }
            const errObj: DeleteRecurringExpenseError = respError
              ? (respError as DeleteRecurringExpenseError)
              : {
                  error: 'Error',
                  message: response.statusText,
                  code: String(response.status),
                }
            toast.error(errObj.message || 'Failed to delete recurring expense')
            return err(errObj)
          }),
        (): DeleteRecurringExpenseError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),

    onMutate: async ({ templateId }): Promise<MutationContext> => {
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isErr()) return undefined
      const queryKey = queryKeys.recurringExpenses.byUser(userIdResult.value)

      await queryClient.cancelQueries({ queryKey })
      const previous =
        queryClient.getQueryData<UserRecurringExpensesSuccess>(queryKey)

      queryClient.setQueryData<UserRecurringExpensesSuccess>(queryKey, (old) =>
        old
          ? {
              ...old,
              templates: old.templates.filter((t) => t.id !== templateId),
            }
          : old,
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
