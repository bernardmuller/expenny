import { err, ok } from 'neverthrow'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import { withSession } from '../with-token'
import type { Result } from 'neverthrow'
import type { paths } from '../schema'
import type { ActiveBudgetSuccess } from '../queries/budget'
import type { BudgetDetailSuccess } from '../queries/budget-detail'
import type { CategoriesRequestSuccess } from './use-categories'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

type CreateTransactionBody = NonNullable<
  paths['/budgets/{id}/transactions']['post']['requestBody']
>['content']['application/json']

type CreateTransactionSuccess =
  paths['/budgets/{id}/transactions']['post']['responses']['201']['content']['application/json']

type CreateTransactionError =
  | paths['/budgets/{id}/transactions']['post']['responses']['404']['content']['application/json']
  | paths['/budgets/{id}/transactions']['post']['responses']['422']['content']['application/json']
  | paths['/budgets/{id}/transactions']['post']['responses']['500']['content']['application/json']

export function useCreateTransaction(budgetId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.transactions.create(),
    mutationFn: async (
      body: CreateTransactionBody,
    ): Promise<Result<CreateTransactionSuccess, CreateTransactionError>> => {
      return withSession(
        () => {
          return toResult(
            client.POST('/budgets/{id}/transactions', {
              params: {
                path: { id: budgetId },
              },
              body,
            }),
          )
            .andThen((data) => {
              toast.success('Transaction created successfully!')
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to create transaction')
              return error
            })
        },
        (): CreateTransactionError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      )
    },
    onMutate: async (newTransaction) => {
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isErr()) return

      const userId = userIdResult.value
      const activeBudgetQueryKey = queryKeys.budgets.active(userId)
      const budgetDetailQueryKey = queryKeys.budgets.detail(budgetId)

      await queryClient.cancelQueries({ queryKey: activeBudgetQueryKey })
      await queryClient.cancelQueries({ queryKey: budgetDetailQueryKey })

      const previousBudget = queryClient.getQueryData(activeBudgetQueryKey)
      const previousBudgetDetail =
        queryClient.getQueryData(budgetDetailQueryKey)

      const categories = queryClient.getQueryData<CategoriesRequestSuccess>(
        queryKeys.categories.all,
      )
      const category = categories?.categories.find(
        (cat) => cat.id === newTransaction.categoryId,
      )

      if (!category)
        return {
          previousBudget,
          previousBudgetDetail,
          activeBudgetQueryKey,
          budgetDetailQueryKey,
        }

      const optimisticTransaction = {
        id: `temp-${Date.now()}`,
        description: newTransaction.description,
        amount: newTransaction.amount.toString(),
        category: category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        budgetId: budgetId,
        categoryId: newTransaction.categoryId,
      }

      queryClient.setQueryData(
        activeBudgetQueryKey,
        (old: ActiveBudgetSuccess | undefined) => {
          if (!old) return old

          const currentAmount = parseFloat(old.currentAmount)
          const newAmount = currentAmount - newTransaction.amount

          const updatedExpenses = [
            optimisticTransaction,
            ...old.expenses.slice(0, -1),
          ]

          return {
            ...old,
            currentAmount: newAmount.toString(),
            expenses: updatedExpenses,
          }
        },
      )

      queryClient.setQueryData(
        budgetDetailQueryKey,
        (old: BudgetDetailSuccess | undefined) => {
          if (!old) return old

          const currentAmount = parseFloat(old.budget.currentAmount)
          const newAmount = currentAmount - newTransaction.amount

          const updatedExpenses = [
            optimisticTransaction,
            ...old.budget.expenses,
          ]

          const updatedCategoryBreakdown = old.budget.categoryBreakdown.map(
            (cat) => {
              if (cat.id === newTransaction.categoryId) {
                const currentSpent = parseFloat(cat.spent)
                const newSpent = currentSpent + newTransaction.amount
                return {
                  ...cat,
                  spent: newSpent.toString(),
                }
              }
              return cat
            },
          )

          return {
            ...old,
            currentAmount: newAmount.toString(),
            expenses: updatedExpenses,
            categoryBreakdown: updatedCategoryBreakdown,
          }
        },
      )

      return {
        previousBudget,
        previousBudgetDetail,
        activeBudgetQueryKey,
        budgetDetailQueryKey,
      }
    },
    onError: (_err, _newTransaction, context) => {
      if (context?.previousBudget) {
        queryClient.setQueryData(
          context.activeBudgetQueryKey,
          context.previousBudget,
        )
      }
      if (context?.previousBudgetDetail) {
        queryClient.setQueryData(
          context.budgetDetailQueryKey,
          context.previousBudgetDetail,
        )
      }
    },
    onSuccess: () => {
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isOk()) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.active(userIdResult.value),
        })
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all,
      })
    },
  })
}
