import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, ResultAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client } from '../client'
import { queryKeys } from '../query-keys'
import { withSession } from '../with-token'
import type { BudgetRecurringExpensesSuccess } from '../queries/recurring-expenses/getBudgetRecurringExpenses'

type DeleteInstanceError = {
  error: string
  message: string
  code: string
}

type Variables = {
  budgetId: string
  instanceId: string
}

type MutationContext = {
  previousInstances: BudgetRecurringExpensesSuccess | undefined
  instancesQueryKey: readonly unknown[]
}

export function useDeleteRecurringExpenseInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.recurringExpenses.instance.delete(),
    mutationFn: async ({
      budgetId,
      instanceId,
    }: Variables): Promise<Result<{ id: string }, DeleteInstanceError>> =>
      withSession(
        () =>
          ResultAsync.fromPromise(
            client.DELETE(
              '/budgets/{budgetId}/recurring-expenses/{instanceId}',
              {
                params: { path: { budgetId, instanceId } },
              },
            ),
            (e): DeleteInstanceError => ({
              error: 'NetworkError',
              message: String(e),
              code: 'NETWORK_ERROR',
            }),
          ).andThen(({ response, error: respError }) => {
            if (response.ok) {
              toast.success('Recurring expense removed')
              return ok({ id: instanceId })
            }
            const errObj: DeleteInstanceError = respError
              ? (respError as DeleteInstanceError)
              : {
                  error: 'Error',
                  message: response.statusText,
                  code: String(response.status),
                }
            toast.error(errObj.message || 'Failed to remove recurring expense')
            return err(errObj)
          }),
        (): DeleteInstanceError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),

    onMutate: async ({ budgetId, instanceId }): Promise<MutationContext> => {
      const instancesQueryKey = queryKeys.recurringExpenses.byBudget(budgetId)
      await queryClient.cancelQueries({ queryKey: instancesQueryKey })
      const previousInstances =
        queryClient.getQueryData<BudgetRecurringExpensesSuccess>(
          instancesQueryKey,
        )

      queryClient.setQueryData<BudgetRecurringExpensesSuccess>(
        instancesQueryKey,
        (old) => {
          if (!old) return old
          return {
            ...old,
            recurringExpenses: old.recurringExpenses.filter(
              (i) => i.id !== instanceId,
            ),
          }
        },
      )

      return { previousInstances, instancesQueryKey }
    },

    onError: (_err, _vars, context) => {
      if (!context) return
      if (context.previousInstances)
        queryClient.setQueryData(
          context.instancesQueryKey,
          context.previousInstances,
        )
    },

    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.recurringExpenses.byBudget(vars.budgetId),
      })
    },
  })
}
