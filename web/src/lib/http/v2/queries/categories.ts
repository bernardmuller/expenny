import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import {
  applyCategoryCreated,
  applyCategoryGroupCreated,
  applyCategoryGroupRemoved,
  applyCategoryGroupUpdated,
  applyCategoryRemoved,
  applyCategoryUpdated,
  applyGroupPatchedToCategories,
  applyGroupRemovedFromCategories,
  invalidateCategoryData,
  optimisticId,
} from '../cache'
import type {
  CategoryGroupsResponse,
  StatementCategoriesResponse,
  StatementCategory,
  StatementCategoryGroup,
} from '../types'

async function fetchStatementCategories(): Promise<StatementCategoriesResponse> {
  try {
    return await apiFetch<StatementCategoriesResponse>('/v2/categories')
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load categories',
    )
    throw error
  }
}

export function getStatementCategoriesQueryOptions() {
  return {
    queryKey: queryKeys.statements.categories,
    queryFn: fetchStatementCategories,
    staleTime: 60 * 60 * 1000,
  }
}

async function fetchCategoryGroups(): Promise<CategoryGroupsResponse> {
  try {
    return await apiFetch<CategoryGroupsResponse>('/v2/category-groups')
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load category groups',
    )
    throw error
  }
}

export function getCategoryGroupsQueryOptions() {
  return {
    queryKey: queryKeys.categoryGroups,
    queryFn: fetchCategoryGroups,
  }
}

export type CategoryMutationInput = {
  key: string
  label: string
  icon: string
  /** Omit to leave memberships untouched; send to replace them. */
  groupIds?: Array<string>
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CategoryMutationInput) =>
      apiFetch<StatementCategory>('/v2/categories', {
        method: 'POST',
        body: {
          key: input.key,
          label: input.label,
          icon: input.icon,
          group_ids: input.groupIds,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.statements.categories,
      })

      const previous = queryClient.getQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
      )
      const tempId = optimisticId('category')
      const groups =
        queryClient.getQueryData<CategoryGroupsResponse>(
          queryKeys.categoryGroups,
        )?.groups ?? []

      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) =>
          applyCategoryCreated(old, {
            id: tempId,
            key: input.key,
            label: input.label,
            icon: input.icon,
            groups: groups.filter((group) =>
              input.groupIds?.includes(group.id),
            ),
          }),
      )

      return { previous, tempId }
    },
    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.statements.categories,
          context.previous,
        )
      }
      toast.error(error.message || 'Failed to create the category')
    },
    onSuccess: (created, _input, context) => {
      // Swap the optimistic row for the server's before refetching.
      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) =>
          old
            ? {
                ...old,
                categories: old.categories.map((category) =>
                  category.id === context.tempId ? created : category,
                ),
              }
            : old,
      )
      invalidateCategoryData(queryClient)
      toast.success('Category created')
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CategoryMutationInput & { id: string }) =>
      apiFetch<StatementCategory>(`/v2/categories/${input.id}`, {
        method: 'PATCH',
        body: {
          key: input.key,
          label: input.label,
          icon: input.icon,
          group_ids: input.groupIds,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.statements.categories,
      })

      const previous = queryClient.getQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
      )
      const groups =
        input.groupIds === undefined
          ? null
          : (queryClient.getQueryData<CategoryGroupsResponse>(
              queryKeys.categoryGroups,
            )?.groups ?? [])

      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) =>
          applyCategoryUpdated(old, {
            id: input.id,
            key: input.key,
            label: input.label,
            icon: input.icon,
            ...(groups
              ? {
                  groups: groups.filter((group) =>
                    input.groupIds?.includes(group.id),
                  ),
                }
              : {}),
          }),
      )

      return { previous }
    },
    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.statements.categories,
          context.previous,
        )
      }
      toast.error(error.message || 'Failed to update the category')
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) => applyCategoryUpdated(old, updated),
      )
      invalidateCategoryData(queryClient)
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v2/categories/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.statements.categories,
      })

      const previous = queryClient.getQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
      )
      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) => applyCategoryRemoved(old, id),
      )

      return { previous }
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.statements.categories,
          context.previous,
        )
      }
      toast.error(error.message || 'Failed to delete the category')
    },
    onSuccess: () => {
      invalidateCategoryData(queryClient)
      toast.success('Category deleted')
    },
  })
}

export type CategoryGroupMutationInput = {
  key: string
  label: string
}

export function useCreateCategoryGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CategoryGroupMutationInput) =>
      apiFetch<StatementCategoryGroup>('/v2/category-groups', {
        method: 'POST',
        body: { key: input.key, label: input.label },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categoryGroups })

      const previous = queryClient.getQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
      )
      const group: StatementCategoryGroup = {
        id: optimisticId('category-group'),
        key: input.key,
        label: input.label,
      }

      queryClient.setQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
        (old) => applyCategoryGroupCreated(old, group),
      )

      return { previous, tempId: group.id }
    },
    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categoryGroups, context.previous)
      }
      toast.error(error.message || 'Failed to create the category group')
    },
    onSuccess: (created, _input, context) => {
      queryClient.setQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
        (old) =>
          old
            ? {
                ...old,
                groups: old.groups.map((group) =>
                  group.id === context.tempId ? created : group,
                ),
              }
            : old,
      )
      invalidateCategoryData(queryClient)
      toast.success('Category group created')
    },
  })
}

export function useUpdateCategoryGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CategoryGroupMutationInput & { id: string }) =>
      apiFetch<StatementCategoryGroup>(`/v2/category-groups/${input.id}`, {
        method: 'PATCH',
        body: { key: input.key, label: input.label },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categoryGroups })

      const previousGroups = queryClient.getQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
      )
      const previousCategories =
        queryClient.getQueryData<StatementCategoriesResponse>(
          queryKeys.statements.categories,
        )
      const patch: StatementCategoryGroup = {
        id: input.id,
        key: input.key,
        label: input.label,
      }

      queryClient.setQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
        (old) => applyCategoryGroupUpdated(old, patch),
      )
      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) => applyGroupPatchedToCategories(old, patch),
      )

      return { previousGroups, previousCategories }
    },
    onError: (error: Error, _input, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(
          queryKeys.categoryGroups,
          context.previousGroups,
        )
      }
      if (context?.previousCategories) {
        queryClient.setQueryData(
          queryKeys.statements.categories,
          context.previousCategories,
        )
      }
      toast.error(error.message || 'Failed to update the category group')
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
        (old) => applyCategoryGroupUpdated(old, updated),
      )
      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) => applyGroupPatchedToCategories(old, updated),
      )
      invalidateCategoryData(queryClient)
    },
  })
}

export function useDeleteCategoryGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v2/category-groups/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categoryGroups })

      const previousGroups = queryClient.getQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
      )
      const previousCategories =
        queryClient.getQueryData<StatementCategoriesResponse>(
          queryKeys.statements.categories,
        )

      queryClient.setQueryData<CategoryGroupsResponse>(
        queryKeys.categoryGroups,
        (old) => applyCategoryGroupRemoved(old, id),
      )
      queryClient.setQueryData<StatementCategoriesResponse>(
        queryKeys.statements.categories,
        (old) => applyGroupRemovedFromCategories(old, id),
      )

      return { previousGroups, previousCategories }
    },
    onError: (error: Error, _id, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(
          queryKeys.categoryGroups,
          context.previousGroups,
        )
      }
      if (context?.previousCategories) {
        queryClient.setQueryData(
          queryKeys.statements.categories,
          context.previousCategories,
        )
      }
      toast.error(error.message || 'Failed to delete the category group')
    },
    onSuccess: () => {
      invalidateCategoryData(queryClient)
      toast.success('Category group deleted')
    },
  })
}
