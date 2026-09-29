import { err, ok } from 'neverthrow'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import { withSession } from '../with-token'
import type { Result } from 'neverthrow'
import type { paths } from '../schema'
import type { ActiveBudgetSuccess } from '../queries/budget'
import type { BudgetExpensesSuccess } from '../queries/budgets/getBudgetExpenses'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

type DeleteExpenseParams = {
  userId: string
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
  activeQueryKey: readonly string[]
  expensesQueryKey: readonly string[]
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.transactions.delete(),
    mutationFn: async (
      params: DeleteExpenseParams,
    ): Promise<Result<DeleteExpenseSuccess, DeleteExpenseError>> => {
      return withSession(
        () => {
          return toResult(
            client.DELETE(
              '/users/{userId}/budgets/{budgetId}/expenses/{expenseId}',
              {
                params: {
                  path: {
                    userId: params.userId,
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
              toast.error(error.message || 'Failed to delete expense')
              return error
            })
        },
        (): DeleteExpenseError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      )
    },
    onMutate: async (params): Promise<MutationContext | undefined> => {
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isErr()) return

      const userId = userIdResult.value
      const activeQueryKey = queryKeys.budgets.active(userId)
      const expensesQueryKey = queryKeys.budgets.expenses(params.budgetId)

      await queryClient.cancelQueries({ queryKey: activeQueryKey })
      await queryClient.cancelQueries({ queryKey: expensesQueryKey })

      const previousActiveBudget =
        queryClient.getQueryData<ActiveBudgetSuccess>(activeQueryKey)
      const previousExpenses =
        queryClient.getQueryData<BudgetExpensesSuccess>(expensesQueryKey)

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

      queryClient.setQueryData(
        expensesQueryKey,
        (old: BudgetExpensesSuccess | undefined) => {
          if (!old) return old

          const deletedExpense = old.expenses.find(
            (e) => e.id === params.expenseId,
          )
          if (!deletedExpense) return old

          const currentAmount = parseFloat(old.budget.currentAmount)
          const expenseAmount = parseFloat(deletedExpense.amount)
          const newAmount = currentAmount + expenseAmount

          return {
            ...old,
            budget: {
              ...old.budget,
              currentAmount: newAmount.toString(),
            },
            expenses: old.expenses.filter((e) => e.id !== params.expenseId),
          }
        },
      )

      return {
        previousActiveBudget,
        previousExpenses,
        activeQueryKey,
        expensesQueryKey,
      }
    },
    onError: (_err, _params, context: MutationContext | undefined) => {
      if (context?.previousActiveBudget) {
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
