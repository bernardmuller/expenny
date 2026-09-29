import { toast } from 'sonner'
import { format } from 'date-fns'
import { withSession } from '../../with-token'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import type { paths } from '../../schema'
import type { MonthlyChartData } from '@/components/category-chart/CategoryChart.types'

export type CategoryExpensesTimeseriesSuccess =
  paths['/categories/{categoryId}/expenses/timeseries']['get']['responses']['200']['content']['application/json']

type CategoryExpensesTimeseriesError =
  | paths['/categories/{categoryId}/expenses/timeseries']['get']['responses']['404']['content']['application/json']
  | paths['/categories/{categoryId}/expenses/timeseries']['get']['responses']['401']['content']['application/json']

async function fetchCategoryExpensesTimeseries(
  categoryId: string,
  months?: number,
  granularity?: 'month' | 'budget',
): Promise<CategoryExpensesTimeseriesSuccess> {
  const result = await withSession(
    () => {
      return toResult(
        client.GET('/categories/{categoryId}/expenses/timeseries', {
          params: {
            path: { categoryId },
            query: months || granularity ? { months, granularity } : undefined,
          },
        }),
      )
    },
    (): CategoryExpensesTimeseriesError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to get category timeseries data')
      throw error
    },
  )
}

/**
 * Transform month-mode timeseries API response to CategoryChart format
 */
export function transformMonthTimeseriesData(
  data: CategoryExpensesTimeseriesSuccess,
): MonthlyChartData[] {
  return data.timeseries.map((item) => ({
    month: item.period ? format(new Date(item.period), 'MMM yyyy') : '',
    spent: item.totalAmount,
    budget: undefined,
    period: item.period,
  }))
}

/**
 * Transform budget-mode timeseries API response to CategoryChart format
 */
export function transformBudgetTimeseriesData(
  data: CategoryExpensesTimeseriesSuccess,
): MonthlyChartData[] {
  return data.timeseries.map((item) => ({
    month: item.budgetName || '',
    spent: item.totalAmount,
    budget: item.budgetAmount,
    budgetId: item.budgetId,
  }))
}

/**
 * Transform timeseries API response to CategoryChart format
 * @deprecated Use transformMonthTimeseriesData or transformBudgetTimeseriesData instead
 */
function transformTimeseriesData(
  data: CategoryExpensesTimeseriesSuccess,
): MonthlyChartData[] {
  return transformMonthTimeseriesData(data)
}

export function getCategoryExpensesTimeseriesQueryOptions(
  categoryId: string,
  months?: number,
) {
  return {
    queryKey: queryKeys.categories.timeseries(categoryId, months, 'month'),
    queryFn: () => fetchCategoryExpensesTimeseries(categoryId, months, 'month'),
  }
}

export function getCategoryExpensesBudgetTimeseriesQueryOptions(
  categoryId: string,
  months?: number,
) {
  return {
    queryKey: queryKeys.categories.timeseries(categoryId, months, 'budget'),
    queryFn: () =>
      fetchCategoryExpensesTimeseries(categoryId, months, 'budget'),
  }
}
