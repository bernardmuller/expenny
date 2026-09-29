import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { ok, err } from 'neverthrow'
import { client, toResult } from '../client'
import { queryKeys } from '../query-keys'
import type { paths } from '../schema'
import { withSession } from '../with-token'

type CheckInSuccess =
  paths['/streaks/check-in']['post']['responses']['200']['content']['application/json']

type CheckInError = {
  error: string
  message: string
  code: string
}

export function useCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: queryKeys.streak.checkIn(),
    mutationFn: async (): Promise<Result<CheckInSuccess, CheckInError>> =>
      withSession(
        () => toResult(client.POST('/streaks/check-in', {})),
        (): CheckInError => ({
          error: 'Unauthorized',
          message: 'You are not signed in',
          code: 'NOT_AUTHENTICATED',
        }),
      )().match(
        (data) => ok(data),
        (error) => err(error),
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streak.all })
    },
  })
}
