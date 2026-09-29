import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err, ResultAsync } from 'neverthrow'
import { toast } from 'sonner'
import { client } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { withSession } from '../with-token'
import type { BudgetDetailSuccess } from '../queries/budget-detail'
import type { BudgetRecurringExpensesSuccess } from '../queries/recurring-expenses/getBudgetRecurringExpenses'
import type { ActiveBudgetSuccess } from '../queries/budget'

type UpdateInstanceStatusBody = NonNullable<
  paths['/budgets/{budgetId}/recurring-expenses/{instanceId}']['patch']['requestBody']
>['content']['application/json']

type MarkPaidSuccess =
  paths['/budgets/{budgetId}/recurring-expenses/{instanceId}']['patch']['responses']['200']['content']['application/json']

type UpdateInstanceStatusError = {
  error: string
  message: string
  code: string
}

type Variables = {
  budgetId: string
  instanceId: string
  body: UpdateInstanceStatusBody
}

type MutationContext = {
  previousInstances: BudgetRecurringExpensesSuccess | undefined
  previousBudgetDetail: BudgetDetailSuccess | undefined
  previousActiveBudget: ActiveBudgetSuccess | undefined
  instancesQueryKey: readonly unknown[]
  detailQueryKey: readonly unknown[]
  activeQueryKey: readonly unknown[] | null
}

export function useUpdateRecurringExpenseStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.recurringExpenses.instance.update(),
    mutationFn: async ({
      budgetId,
      instanceId,
      body,
    }: Variables): Promise<
      Result<MarkPaidSuccess | null, UpdateInstanceStatusError>
    > =>
      withSession(
        () =>
          ResultAsync.fromPromise(
            client.PATCH(
              '/budgets/{budgetId}/recurring-expenses/{instanceId}',
              {
                params: { path: { budgetId, instanceId } },
                body,
              },
            ),
            (e): UpdateInstanceStatusError => ({
              error: 'NetworkError',
              message: String(e),
              code: 'NETWORK_ERROR',
            }),
          ).andThen(({ response, data, error: respError }) => {
            if (response.ok) {
              return ok((data ?? null) as MarkPaidSuccess | null)
            }
            const errObj: UpdateInstanceStatusError = respError
              ? (respError as UpdateInstanceStatusError)
              : {
                  error: 'Error',
                  message: response.statusText,
                  code: String(response.status),
                }
            toast.error(errObj.message || 'Failed to update recurring expense')
            return err(errObj)
          }),
        (): UpdateInstanceStatusError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),

    onMutate: async ({
      budgetId,
      instanceId,
      body,
    }): Promise<MutationContext> => {
      const userIdResult = getUserIdFromAccessToken()
      const instancesQueryKey = queryKeys.recurringExpenses.byBudget(budgetId)
      const detailQueryKey = queryKeys.budgets.detail(budgetId)
      const activeQueryKey = userIdResult.isOk()
        ? queryKeys.budgets.active(userIdResult.value)
        : null

      await queryClient.cancelQueries({ queryKey: instancesQueryKey })
      await queryClient.cancelQueries({ queryKey: detailQueryKey })
      if (activeQueryKey)
        await queryClient.cancelQueries({ queryKey: activeQueryKey })

      const previousInstances =
        queryClient.getQueryData<BudgetRecurringExpensesSuccess>(
          instancesQueryKey,
        )
      const previousBudgetDetail =
        queryClient.getQueryData<BudgetDetailSuccess>(detailQueryKey)
      const previousActiveBudget = activeQueryKey
        ? queryClient.getQueryData<ActiveBudgetSuccess>(activeQueryKey)
        : undefined

      const instance = previousInstances?.recurringExpenses.find(
        (i) => i.id === instanceId,
      )

      if (body.isPaid === true) {
        const optimisticExpenseId = `temp-${Date.now()}`
        const amount = body.expenseData.amount

        queryClient.setQueryData<BudgetRecurringExpensesSuccess>(
          instancesQueryKey,
          (old) => {
            if (!old) return old
            return {
              ...old,
              recurringExpenses: old.recurringExpenses.map((i) =>
                i.id === instanceId
                  ? {
                      ...i,
                      isPaid: true,
                      expenseId: optimisticExpenseId,
                      expense: {
                        id: optimisticExpenseId,
                        description: body.expenseData.description,
                        amount: amount.toString(),
                        categoryId: body.expenseData.categoryId,
                        note: body.expenseData.note ?? null,
                        createdAt:
                          body.expenseData.createdAt ??
                          new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        deletedAt: null,
                      },
                    }
                  : i,
              ),
            }
          },
        )

        queryClient.setQueryData<BudgetDetailSuccess>(detailQueryKey, (old) => {
          if (!old) return old
          const currentAmount = parseFloat(old.budget.currentAmount)
          return {
            ...old,
            budget: {
              ...old.budget,
              currentAmount: (currentAmount - amount).toString(),
            },
          }
        })

        if (activeQueryKey) {
          queryClient.setQueryData<ActiveBudgetSuccess>(
            activeQueryKey,
            (old) => {
              if (!old || old.id !== budgetId) return old
              const currentAmount = parseFloat(old.currentAmount)
              return {
                ...old,
                currentAmount: (currentAmount - amount).toString(),
              }
            },
          )
        }
      } else if (body.isPaid === false && instance) {
        const restoredAmount = parseFloat(instance.amount)

        queryClient.setQueryData<BudgetRecurringExpensesSuccess>(
          instancesQueryKey,
          (old) => {
            if (!old) return old
            return {
              ...old,
              recurringExpenses: old.recurringExpenses.map((i) =>
                i.id === instanceId
                  ? { ...i, isPaid: false, expenseId: null, expense: null }
                  : i,
              ),
            }
          },
        )

        queryClient.setQueryData<BudgetDetailSuccess>(detailQueryKey, (old) => {
          if (!old) return old
          const currentAmount = parseFloat(old.budget.currentAmount)
          return {
            ...old,
            budget: {
              ...old.budget,
              currentAmount: (currentAmount + restoredAmount).toString(),
            },
          }
        })

        if (activeQueryKey) {
          queryClient.setQueryData<ActiveBudgetSuccess>(
            activeQueryKey,
            (old) => {
              if (!old || old.id !== budgetId) return old
              const currentAmount = parseFloat(old.currentAmount)
              return {
                ...old,
                currentAmount: (currentAmount + restoredAmount).toString(),
              }
            },
          )
        }
      }

      return {
        previousInstances,
        previousBudgetDetail,
        previousActiveBudget,
        instancesQueryKey,
        detailQueryKey,
        activeQueryKey,
      }
    },

    onError: (_err, _vars, context) => {
      if (!context) return
      if (context.previousInstances)
        queryClient.setQueryData(
          context.instancesQueryKey,
          context.previousInstances,
        )
      if (context.previousBudgetDetail)
        queryClient.setQueryData(
          context.detailQueryKey,
          context.previousBudgetDetail,
        )
      if (context.activeQueryKey && context.previousActiveBudget)
        queryClient.setQueryData(
          context.activeQueryKey,
          context.previousActiveBudget,
        )
    },

    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.recurringExpenses.byBudget(vars.budgetId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.detail(vars.budgetId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.expenses(vars.budgetId),
      })
      const userIdResult = getUserIdFromAccessToken()
      if (userIdResult.isOk()) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.active(userIdResult.value),
        })
      }
    },
  })
}
