import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import { applyBudgetPreferences } from '../cache'
import type { BudgetResponse } from '../types'

export type BudgetPreferencesInput = {
  startDate: string
  endDate: string
  account: string | null
}

export function getBudgetQueryOptions() {
  return {
    queryKey: queryKeys.budget,
    queryFn: () => apiFetch<BudgetResponse>('/v2/budget'),
  }
}

export function useUpdateBudgetPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: [...queryKeys.budget, 'preferences'],
    mutationFn: (input: BudgetPreferencesInput) =>
      apiFetch<BudgetResponse>('/v2/budget/preferences', {
        method: 'PUT',
        body: {
          start_date: input.startDate,
          end_date: input.endDate,
          account: input.account,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget })

      const previous = queryClient.getQueryData<BudgetResponse>(
        queryKeys.budget,
      )
      // Move the card to the picked window straight away; the salary anchor
      // and balance come back with the response.
      queryClient.setQueryData<BudgetResponse>(queryKeys.budget, (old) =>
        applyBudgetPreferences(old, {
          start_date: input.startDate,
          end_date: input.endDate,
          account: input.account,
        }),
      )

      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.budget, context.previous)
      }
      toast.error(error.message || 'Failed to save the budget period')
    },
    onSuccess: (data) => {
      // The API recomputes the whole overview, so the cache can be replaced
      // outright, then invalidated so the derived caches follow.
      queryClient.setQueryData(queryKeys.budget, data)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categoryBudgets,
      })
      toast.success('Budget period saved')
    },
  })
}
