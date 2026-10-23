import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import { applyCategoryAllocation, optimisticId } from '../cache'
import type {
  CategoryBudgetOverview,
  StatementTransactionsResponse,
} from '../types'

async function fetchCategoryBudgets(): Promise<CategoryBudgetOverview> {
  try {
    return await apiFetch<CategoryBudgetOverview>('/v2/category-budgets')
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load the budgets',
    )
    throw error
  }
}

export function getCategoryBudgetsQueryOptions() {
  return {
    queryKey: queryKeys.categoryBudgets,
    queryFn: fetchCategoryBudgets,
  }
}

/**
 * Transactions for one category and transaction group inside the active
 * budget window. An empty group key selects rows without a stored group.
 */
export function getCategoryTransactionsQueryOptions(
  categoryId: string,
  groupKey: string,
) {
  const query = new URLSearchParams({ group_key: groupKey })
  return {
    queryKey: [
      ...queryKeys.categoryBudgets,
      'transactions',
      categoryId,
      groupKey,
    ],
    queryFn: () =>
      apiFetch<StatementTransactionsResponse>(
        `/v2/category-budgets/${categoryId}/transactions?${query.toString()}`,
      ),
    staleTime: 5 * 60 * 1000,
  }
}

/** The string amount the API would return, for the optimistic patch. */
function amountValue(value: number) {
  return value.toFixed(2)
}

function useCategoryBudgetMutation<TInput>(
  mutate: (input: TInput) => Promise<CategoryBudgetOverview>,
  optimistic: (
    input: TInput,
    overview: CategoryBudgetOverview | undefined,
  ) => CategoryBudgetOverview | undefined,
  successMessage: string,
  failureMessage: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: mutate,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categoryBudgets })

      const previous = queryClient.getQueryData<CategoryBudgetOverview>(
        queryKeys.categoryBudgets,
      )
      queryClient.setQueryData<CategoryBudgetOverview>(
        queryKeys.categoryBudgets,
        (old) => optimistic(input, old),
      )

      return { previous }
    },
    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categoryBudgets, context.previous)
      }
      toast.error(error.message || failureMessage)
    },
    onSuccess: (data) => {
      // The API recomputes the overview on every write, so replace the cache
      // outright and then invalidate so the derived spend and the expanded
      // per-category lists follow.
      queryClient.setQueryData(queryKeys.categoryBudgets, data)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categoryBudgets,
      })
      toast.success(successMessage)
    },
  })
}

export function useSetCategoryBudget() {
  return useCategoryBudgetMutation(
    (input: { categoryId: string; amount: number }) =>
      apiFetch<CategoryBudgetOverview>('/v2/category-budgets', {
        method: 'POST',
        body: {
          category_id: input.categoryId,
          allocated_amount: input.amount,
        },
      }),
    (input, overview) =>
      applyCategoryAllocation(
        overview,
        { categoryId: input.categoryId },
        {
          allocated: amountValue(input.amount),
          categoryBudgetId: optimisticId('category-budget'),
        },
      ),
    'Category budget saved',
    'Failed to save the category budget',
  )
}

export function useUpdateCategoryBudget() {
  return useCategoryBudgetMutation(
    (input: { categoryBudgetId: string; amount: number }) =>
      apiFetch<CategoryBudgetOverview>(
        `/v2/category-budgets/${input.categoryBudgetId}`,
        {
          method: 'PATCH',
          body: { allocated_amount: input.amount },
        },
      ),
    (input, overview) =>
      applyCategoryAllocation(
        overview,
        { categoryBudgetId: input.categoryBudgetId },
        {
          allocated: amountValue(input.amount),
          categoryBudgetId: input.categoryBudgetId,
        },
      ),
    'Category budget updated',
    'Failed to update the category budget',
  )
}

export function useDeleteCategoryBudget() {
  return useCategoryBudgetMutation(
    (categoryBudgetId: string) =>
      apiFetch<CategoryBudgetOverview>(
        `/v2/category-budgets/${categoryBudgetId}`,
        { method: 'DELETE' },
      ),
    (categoryBudgetId, overview) =>
      applyCategoryAllocation(
        overview,
        { categoryBudgetId },
        { allocated: null, categoryBudgetId: null },
      ),
    'Category budget removed',
    'Failed to remove the category budget',
  )
}
