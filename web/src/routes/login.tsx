import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { GoogleGlyph } from '@/components/ui/google-glyph'
import { getGoogleConfigured } from '@/lib/auth/auth-mode'
import { useAuth } from '@/lib/auth/auth-provider'
import { bootstrapSessionFromCookie } from '@/lib/auth/session-sync'
import { getStoredCurrentUser, hasSession } from '@/lib/auth/token-storage'
import {
  PENDING_OAUTH_KEY,
  capturePendingOAuth,
  consumePendingOAuth,
  hasAuthorizeParams,
  startGoogleSignIn,
} from '@/lib/auth/social-sign-in'
import { toast } from 'sonner'

/** The only account this private deployment serves. */
export const ALLOWED_EMAIL = 'b.mullerjnr@gmail.com'

function isAllowedEmail(email?: string): boolean {
  return email?.toLowerCase() === ALLOWED_EMAIL
}

function oauthErrorMessage(code: string): string {
  switch (code) {
    case 'state_mismatch':
    case 'state_not_found':
    case 'please_restart_the_process':
      return 'Sign-in timed out. Please try again.'
    case 'account_not_linked':
      return 'That email already has an account — sign in with your email code first.'
    case 'forbidden':
    case 'FORBIDDEN':
      return `This app is private to ${ALLOWED_EMAIL}.`
    default:
      return 'Sign-in failed. Please try again.'
  }
}

export const Route = createFileRoute('/login')({
  beforeLoad: ({ location }) => {
    const params = new URLSearchParams(
      location.search as Record<string, string>,
    )
    const isMidOAuth =
      hasAuthorizeParams(params) || params.get('resume') === '1'
    if (hasSession() && !isMidOAuth) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [googleBusy, setGoogleBusy] = useState(false)

  const googleConfigured = getGoogleConfigured()

  useEffect(() => {
    const search = window.location.search
    const params = new URLSearchParams(search)

    const error = params.get('error')
    if (error) {
      toast.error(oauthErrorMessage(error))
      sessionStorage.removeItem(PENDING_OAUTH_KEY)
      navigate({ to: '/login', replace: true })
      return
    }

    if (params.get('resume') === '1') {
      const resumeUrl = consumePendingOAuth()
      void bootstrapSessionFromCookie().then(() => {
        if (!hasSession()) {
          toast.error('Sign-in did not complete. Please try again.')
          return
        }

        // Only one account may use this deployment. Anyone else is signed
        // back out rather than shown an empty app.
        const user = getStoredCurrentUser()
        if (user && !isAllowedEmail(user.email)) {
          toast.error(`This app is private to ${ALLOWED_EMAIL}.`)
          void auth.logout()
          return
        }

        if (resumeUrl) {
          window.location.href = resumeUrl
          return
        }

        auth.login()
        navigate({ to: '/' })
      })
      return
    }

    const pending = capturePendingOAuth(search)

    if (pending && hasAuthorizeParams(params) && hasSession()) {
      consumePendingOAuth()
      window.location.href = pending
    }
  }, [auth, navigate])

  const handleGoogleLogin = async () => {
    setGoogleBusy(true)
    const started = await startGoogleSignIn()
    if (!started) {
      toast.error('Could not start Google sign-in')
      setGoogleBusy(false)
    }
  }

  return (
    <div
      className="bg-background flex min-h-screen items-center justify-center
        p-4"
    >
      <div className="flex w-full max-w-md flex-col items-center space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <img src="/favicon.ico" alt="Logo" className="h-16 w-16" />
          <h1 className="text-foreground text-2xl font-semibold">
            Sign in to your account
          </h1>
        </div>

        {googleConfigured ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={googleBusy}
            onClick={handleGoogleLogin}
          >
            <GoogleGlyph />
            {googleBusy ? 'Redirecting to Google…' : 'Continue with Google'}
          </Button>
        ) : (
          <p className="text-muted-foreground text-center text-sm">
            Google sign-in is not configured on this deployment.
          </p>
        )}
      </div>
    </div>
  )
}
