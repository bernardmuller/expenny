import { client, toResult } from '../client'
import { withSession } from '../with-token'

export const getUserById = (userId: string) =>
  withSession(
    () =>
      toResult(
        client.GET('/users/{id}', {
          params: {
            path: { id: userId },
          },
        }),
      ),
    () => ({
      error: 'Failed to get user',
      message: 'Failed to get user',
      code: 'REQUEST FAILED',
    }),
  )
