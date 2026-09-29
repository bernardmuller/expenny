import {
  createFileRoute,
  Link,
  useNavigate,
  redirect,
} from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import z from 'zod'
import { useAppForm } from '@/hooks/form'
import { FieldGroup } from '@/components/ui/field'
import OtpForm from '@/components/otp-form/OtpForm'
import { useLoginRequest } from '@/lib/http/hooks/use-login-request'
import { useLoginVerify } from '@/lib/http/hooks/use-login-verify'
import { useAuth } from '@/lib/auth/auth-provider'
import { hasSession } from '@/lib/auth/token-storage'
import { bootstrapSessionFromCookie } from '@/lib/auth/session-sync'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { GoogleGlyph } from '@/components/ui/google-glyph'
import { getGoogleConfigured } from '@/lib/auth/auth-mode'
import {
  PENDING_OAUTH_KEY,
  capturePendingOAuth,
  consumePendingOAuth,
  hasAuthorizeParams,
  startGoogleSignIn,
} from '@/lib/auth/social-sign-in'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.email('Please provide a valid email address'),
})

function oauthErrorMessage(code: string): string {
  switch (code) {
    case 'state_mismatch':
    case 'state_not_found':
    case 'please_restart_the_process':
      return 'Sign-in timed out. Please try again.'
    case 'account_not_linked':
      return 'That email already has an account — sign in with your email code first.'
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

type Step = 'login' | 'verify'

function LoginPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [step, setStep] = useState<Step>('login')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)

  const googleConfigured = getGoogleConfigured()

  const loginMutation = useLoginRequest()
  const verifyMutation = useLoginVerify()

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
      if (resumeUrl) {
        window.location.href = resumeUrl
        return
      }
      void bootstrapSessionFromCookie().then(() => {
        if (hasSession()) {
          auth.login()
          navigate({ to: '/' })
        } else {
          toast.error('Sign-in did not complete. Please try again.')
        }
      })
      return
    }

    const pending = capturePendingOAuth(search)

    if (pending && hasAuthorizeParams(params) && hasSession()) {
      consumePendingOAuth()
      window.location.href = pending
    }
  }, [auth, navigate])

  const handleLoginSubmit = async (value: { email: string }) => {
    const result = await loginMutation.mutateAsync(value)
    if (result.isOk()) {
      if (process.env.NODE_ENV === 'development') {
        setDevOtp(result._unsafeUnwrap().otp ?? null)
      }
      setStep('verify')
    }
  }

  const form = useAppForm({
    defaultValues: {
      email: '',
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      await handleLoginSubmit(value)
    },
  })

  const handleOtpSubmit = async (value: { otp: string }) => {
    const result = await verifyMutation.mutateAsync(value)
    if (result.isOk()) {
      auth.login()
      const resumeUrl = consumePendingOAuth()
      if (resumeUrl) {
        window.location.href = resumeUrl
      } else {
        navigate({ to: '/' })
      }
    }
  }

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
      <div className="w-full max-w-md">
        {step === 'login' ? (
          <div className="flex flex-col items-center space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <img src="/favicon.ico" alt="Logo" className="h-16 w-16" />
              <h1 className="text-foreground text-2xl font-semibold">
                Sign in to your account
              </h1>
            </div>

            <form
              id="login-form"
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
              className="w-full space-y-6"
            >
              <FieldGroup>
                <form.AppField
                  name="email"
                  children={(field) => (
                    <field.TextField placeholder="john.doe@example.com" />
                  )}
                />
              </FieldGroup>

              <form.AppForm>
                <form.FormButton
                  enabledText="Sign in"
                  loadingText="Signing in"
                  disabledText="Enter your email to log in"
                  formId="login-form"
                />
              </form.AppForm>
            </form>

            {googleConfigured && (
              <>
                <div className="flex w-full items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-muted-foreground text-xs uppercase">
                    or
                  </span>
                  <Separator className="flex-1" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={googleBusy}
                  onClick={handleGoogleLogin}
                >
                  <GoogleGlyph />
                  {googleBusy
                    ? 'Redirecting to Google…'
                    : 'Continue with Google'}
                </Button>
              </>
            )}

            <div className="text-muted-foreground text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="cursor-pointer">
                <span className="text-primary hover:underline">
                  Create one now →
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {process.env.NODE_ENV === 'development' && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2 className="text-lg">Development mode</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>OTP: {devOtp}</p>
                </CardContent>
              </Card>
            )}
            <OtpForm
              title="Verify Your Login"
              onSubmit={handleOtpSubmit}
              linkProvider={({ children }) => (
                <span
                  onClick={() => setStep('login')}
                  className="cursor-pointer"
                >
                  {children}
                </span>
              )}
            />
          </>
        )}
      </div>
    </div>
  )
}
