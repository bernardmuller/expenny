import { toast } from 'sonner'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import { withSession } from '../../with-token'
import type { paths } from '../../schema'

export type BudgetRecurringExpensesSuccess =
  paths['/budgets/{budgetId}/recurring-expenses']['get']['responses']['200']['content']['application/json']

export type BudgetRecurringExpense =
  BudgetRecurringExpensesSuccess['recurringExpenses'][number]

type BudgetRecurringExpensesError = {
  error: string
  message: string
  code: string
}

async function fetchBudgetRecurringExpenses(
  budgetId: string,
): Promise<BudgetRecurringExpensesSuccess> {
  const result = await withSession(
    () =>
      toResult(
        client.GET('/budgets/{budgetId}/recurring-expenses', {
          params: { path: { budgetId } },
        }),
      ),
    (): BudgetRecurringExpensesError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to load recurring expenses')
      throw error
    },
  )
}

export function getBudgetRecurringExpensesQueryOptions(budgetId: string) {
  return {
    queryKey: queryKeys.recurringExpenses.byBudget(budgetId),
    queryFn: () => fetchBudgetRecurringExpenses(budgetId),
  }
}
