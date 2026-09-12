import { useMutation } from '@tanstack/react-query'
import type { Result } from 'neverthrow'
import { toast } from 'sonner'
import { client, toResult } from '../client'
import { withToken } from '../with-token'
import { queryKeys } from '../query-keys'
import { setCurrentUser, setTokens } from '@/lib/auth/token-storage'
import { getAuthMode } from '@/lib/auth/auth-mode'
import { syncCurrentUserFromSession } from '@/lib/auth/session-sync'
import type { paths } from '../schema'

type RegisterVerifyBody =
  paths['/auth/register/verify']['post']['requestBody']['content']['application/json']

type RegisterVerifySuccess =
  paths['/auth/register/verify']['post']['responses']['200']['content']['application/json']

type RegisterVerifyError =
  | paths['/auth/register/verify']['post']['responses']['401']['content']['application/json']
  | paths['/auth/register/verify']['post']['responses']['404']['content']['application/json']
  | paths['/auth/register/verify']['post']['responses']['500']['content']['application/json']

export function useRegisterVerify() {
  return useMutation({
    mutationKey: queryKeys.auth.register.verify(
      sessionStorage.getItem('token') || '',
    ),
    mutationFn: async (
      body: RegisterVerifyBody,
    ): Promise<Result<RegisterVerifySuccess, RegisterVerifyError>> =>
      withToken(
        (ctx) =>
          toResult(
            client.POST('/auth/register/verify', {
              params: {
                header: {
                  authorization: `Bearer ${ctx.token}`,
                },
              },
              body,
            }),
          )
            .map(async (data) => {
              setTokens(data.accessToken, data.refreshToken)
              if (getAuthMode() === 'better-auth') {
                setCurrentUser({
                  userId: data.user.id,
                  email: data.user.email,
                  name: data.user.name,
                })
              }
              sessionStorage.removeItem('token')
              await syncCurrentUserFromSession()
              return data
            })
            .mapErr((error) => {
              toast.error(error.message || 'Failed to verify registration')
              return error
            }),
        (): RegisterVerifyError => ({
          error: 'Unauthorized',
          message: 'No verification token found',
          code: 'MISSING_TOKEN',
        }),
      )(),
  })
}
