import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import {
  applyCorrectionCreated,
  applyCorrectionRemoved,
  applyCorrectionUpdated,
  optimisticId,
} from '../cache'
import type {
  Correction,
  CorrectionsResponse,
  StatementCategoriesResponse,
} from '../types'

async function fetchCorrections(): Promise<CorrectionsResponse> {
  try {
    return await apiFetch<CorrectionsResponse>('/v2/corrections')
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load corrections',
    )
    throw error
  }
}

export function getCorrectionsQueryOptions() {
  return {
    queryKey: queryKeys.corrections,
    queryFn: fetchCorrections,
  }
}

export type CorrectionWriteInput = {
  description: string
  categoryId: string
}

/** The category object the list renders, read off the categories cache. */
function cachedCategory(queryClient: QueryClient, categoryId: string) {
  return (
    queryClient
      .getQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
      )
      ?.categories.find((category) => category.id === categoryId) ?? null
  )
}

/**
 * Corrections only steer future classification runs, so nothing else on the
 * page derives from them.
 */
function invalidateCorrections(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.corrections })
}

export function useCreateCorrection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CorrectionWriteInput) =>
      apiFetch<Correction>('/v2/corrections', {
        method: 'POST',
        body: {
          description: input.description,
          category_id: input.categoryId,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.corrections })

      const previous = queryClient.getQueryData<CorrectionsResponse>(
        queryKeys.corrections,
      )
      const category = cachedCategory(queryClient, input.categoryId)
      const now = new Date().toISOString()

      queryClient.setQueryData<CorrectionsResponse>(
        queryKeys.corrections,
        (old) =>
          applyCorrectionCreated(old, {
            id: optimisticId('correction'),
            description: input.description.trim(),
            category: category ?? {
              id: input.categoryId,
              key: '',
              label: 'Category',
              icon: '🏷️',
            },
            created_at: now,
            updated_at: now,
          }),
      )

      return { previous }
    },
    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.corrections, context.previous)
      }
      toast.error(error.message || 'Failed to add the correction')
    },
    onSuccess: () => {
      invalidateCorrections(queryClient)
      toast.success('Correction added')
    },
  })
}

export function useUpdateCorrection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CorrectionWriteInput & { id: string }) =>
      apiFetch<Correction>(`/v2/corrections/${input.id}`, {
        method: 'PATCH',
        body: {
          description: input.description,
          category_id: input.categoryId,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.corrections })

      const previous = queryClient.getQueryData<CorrectionsResponse>(
        queryKeys.corrections,
      )
      const category = cachedCategory(queryClient, input.categoryId)

      queryClient.setQueryData<CorrectionsResponse>(
        queryKeys.corrections,
        (old) =>
          applyCorrectionUpdated(old, {
            id: input.id,
            description: input.description.trim(),
            ...(category ? { category } : {}),
            updated_at: new Date().toISOString(),
          }),
      )

      return { previous }
    },
    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.corrections, context.previous)
      }
      toast.error(error.message || 'Failed to update the correction')
    },
    onSuccess: () => {
      invalidateCorrections(queryClient)
      toast.success('Correction updated')
    },
  })
}

export function useDeleteCorrection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v2/corrections/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.corrections })

      const previous = queryClient.getQueryData<CorrectionsResponse>(
        queryKeys.corrections,
      )
      queryClient.setQueryData<CorrectionsResponse>(
        queryKeys.corrections,
        (old) => applyCorrectionRemoved(old, id),
      )

      return { previous }
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.corrections, context.previous)
      }
      toast.error(error.message || 'Failed to delete the correction')
    },
    onSuccess: () => {
      invalidateCorrections(queryClient)
      toast.success('Correction deleted')
    },
  })
}
