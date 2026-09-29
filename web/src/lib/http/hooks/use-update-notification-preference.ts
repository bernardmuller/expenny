import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { withSession } from '../with-token'
import type { NotificationPreferenceWithEntity } from '../queries/notification-preferences/getNotificationPreferences'

type UpdateNotificationPreferenceBody =
  paths['/notification-preferences/{id}']['patch']['requestBody']['content']['application/json']

type UpdateNotificationPreferenceSuccess =
  paths['/notification-preferences/{id}']['patch']['responses']['200']['content']['application/json']

type UpdateNotificationPreferenceError = {
  error: string
  message: string
  code: string
}

type UpdateNotificationPreferenceInput = {
  id: string
  body: UpdateNotificationPreferenceBody
}

type MutationContext = {
  previous: NotificationPreferenceWithEntity[] | undefined
  queryKey: readonly unknown[]
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.notificationPreferences.update(),
    mutationFn: async ({
      id,
      body,
    }: UpdateNotificationPreferenceInput): Promise<
      Result<
        UpdateNotificationPreferenceSuccess,
        UpdateNotificationPreferenceError
      >
    > =>
      withSession(
        () => {
          return toResult(
            client.PATCH('/notification-preferences/{id}', {
              params: { path: { id } },
              body,
            }),
          )
            .andThen((data) => {
              toast.success('Notification preference updated')
              return ok(data)
            })
            .mapErr((error) => {
              toast.error(
                error.message || 'Failed to update notification preference',
              )
              return error
            })
        },
        (): UpdateNotificationPreferenceError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),

    onMutate: async ({ id, body }): Promise<MutationContext> => {
      const queryKey = queryKeys.notificationPreferences.list()
      await queryClient.cancelQueries({ queryKey })
      const previous =
        queryClient.getQueryData<NotificationPreferenceWithEntity[]>(queryKey)
      queryClient.setQueryData<NotificationPreferenceWithEntity[]>(
        queryKey,
        (old) => old?.map((p) => (p.id === id ? { ...p, ...body } : p)),
      )
      return { previous, queryKey }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.queryKey, ctx.previous)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notificationPreferences.all,
      })
    },
  })
}
