import { ok } from 'neverthrow'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import { withSession } from '../with-token'
import type { paths } from '../schema'
import type { ActiveBudgetSuccess } from '../queries/budget'
import type { BudgetExpensesSuccess } from '../queries/budgets/getBudgetExpenses'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

type DeleteExpenseParams = {
  budgetId: string
  expenseId: string
}

type DeleteExpenseSuccess =
  paths['/users/{userId}/budgets/{budgetId}/expenses/{expenseId}']['delete']['responses']['200']['content']['application/json']

type DeleteExpenseError =
  | paths['/users/{userId}/budgets/{budgetId}/expenses/{expenseId}']['delete']['responses']['404']['content']['application/json']
  | paths['/users/{userId}/budgets/{budgetId}/expenses/{expenseId}']['delete']['responses']['500']['content']['application/json']

type MutationContext = {
  previousActiveBudget: ActiveBudgetSuccess | undefined
  previousExpenses: BudgetExpensesSuccess | undefined
  activeQueryKey: ReadonlyArray<string> | undefined
  expensesQueryKey: ReadonlyArray<string>
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.transactions.delete(),
    mutationFn: async (
      params: DeleteExpenseParams,
    ): Promise<DeleteExpenseSuccess> => {
      // Derived here rather than passed in: callers used to fall back to '',
      // which builds an unroutable `/users//budgets/...` URL.
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isErr()) {
        const message = 'Could not identify the signed-in user'
        toast.error(message)
        throw { error: 'Unauthorized', message, code: 'NOT_AUTHENTICATED' }
      }

      const result = await withSession(
        () => {
          return toResult(
            client.DELETE(
              '/users/{userId}/budgets/{budgetId}/expenses/{expenseId}',
              {
                params: {
                  path: {
                    userId: userIdResult.value,
                    budgetId: params.budgetId,
                    expenseId: params.expenseId,
                  },
                },
              },
            ),
          )
            .andThen((data) => {
              toast.success('Expense deleted successfully!')
              return ok(data)
            })
            .mapErr((error) => {
              // Not every error response carries `message` (the 400 body is
              // `{ error }` only), so narrow rather than assume.
              const message =
                'message' in error ? error.message : 'Failed to delete expense'
              toast.error(message || 'Failed to delete expense')
              return error
            })
        },
        (): DeleteExpenseError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )()

      // Throw so React Query treats a failed delete as a failure and runs the
      // optimistic rollback in onError.
      return result.match(
        (data) => data,
        (error) => {
          throw error
        },
      )
    },
    onMutate: async (params): Promise<MutationContext> => {
      const userIdResult = getUserIdFromAccessToken()
      // Without a stored user we can't address the active-budget cache, but the
      // delete itself must still go ahead.
      const activeQueryKey = userIdResult.isOk()
        ? queryKeys.budgets.active(userIdResult.value)
        : undefined
      const expensesQueryKey = queryKeys.budgets.expenses(params.budgetId)

      if (activeQueryKey) {
        await queryClient.cancelQueries({ queryKey: activeQueryKey })
      }
      await queryClient.cancelQueries({ queryKey: expensesQueryKey })

      const previousActiveBudget = activeQueryKey
        ? queryClient.getQueryData<ActiveBudgetSuccess>(activeQueryKey)
        : undefined
      const previousExpenses =
        queryClient.getQueryData<BudgetExpensesSuccess>(expensesQueryKey)

      // A throw here would abort the mutation before mutationFn ever runs —
      // no request, no toast, no rollback. Degrade to "no optimistic update".
      try {
        if (activeQueryKey) {
          queryClient.setQueryData(
            activeQueryKey,
            (old: ActiveBudgetSuccess | undefined) => {
              if (!old) return old

              const deletedExpense = old.expenses.find(
                (e) => e.id === params.expenseId,
              )
              if (!deletedExpense) return old

              const currentAmount = parseFloat(old.currentAmount)
              const expenseAmount = parseFloat(deletedExpense.amount)
              const newAmount = currentAmount + expenseAmount

              return {
                ...old,
                currentAmount: newAmount.toString(),
                expenses: old.expenses.filter((e) => e.id !== params.expenseId),
              }
            },
          )
        }

        queryClient.setQueryData(
          expensesQueryKey,
          (old: BudgetExpensesSuccess | undefined) => {
            if (!old) return old

            const deletedExpense = old.expenses.find(
              (e) => e.id === params.expenseId,
            )
            if (!deletedExpense) return old

            const currentAmount = parseFloat(old.currentAmount)
            const expenseAmount = parseFloat(deletedExpense.amount)
            const newAmount = currentAmount + expenseAmount

            return {
              ...old,
              currentAmount: newAmount.toString(),
              expenses: old.expenses.filter((e) => e.id !== params.expenseId),
            }
          },
        )
      } catch (error) {
        console.error('Optimistic delete-expense update failed', error)
      }

      return {
        previousActiveBudget,
        previousExpenses,
        activeQueryKey,
        expensesQueryKey,
      }
    },
    onError: (_err, _params, context: MutationContext | undefined) => {
      if (context?.activeQueryKey && context.previousActiveBudget) {
        queryClient.setQueryData(
          context.activeQueryKey,
          context.previousActiveBudget,
        )
      }
      if (context?.previousExpenses) {
        queryClient.setQueryData(
          context.expensesQueryKey,
          context.previousExpenses,
        )
      }
    },
    onSuccess: (_data, params) => {
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isOk()) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.active(userIdResult.value),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.expenses(params.budgetId),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringExpenses.byBudget(params.budgetId),
        })
      }
    },
  })
}
