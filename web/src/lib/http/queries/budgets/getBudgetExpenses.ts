import { toast } from 'sonner'
import { withSession } from '../../with-token'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import type { paths } from '../../schema'

export type BudgetExpensesSuccess =
  paths['/budgets/{id}/expenses']['get']['responses']['200']['content']['application/json']

type BudgetExpensesError =
  | paths['/budgets/{id}/expenses']['get']['responses']['404']['content']['application/json']
  | paths['/budgets/{id}/expenses']['get']['responses']['403']['content']['application/json']

async function fetchBudgetExpenses(
  budgetId: string,
): Promise<BudgetExpensesSuccess> {
  const result = await withSession(
    () => {
      return toResult(
        client.GET('/budgets/{id}/expenses', {
          params: {
            path: { id: budgetId },
          },
        }),
      )
    },
    (): BudgetExpensesError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to get budget expenses')
      throw error
    },
  )
}

export function getBudgetExpensesQueryOptions(budgetId: string) {
  return {
    queryKey: queryKeys.budgets.expenses(budgetId),
    queryFn: () => fetchBudgetExpenses(budgetId),
  }
}
