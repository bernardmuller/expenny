import {
  createFileRoute,
  Link,
  useNavigate,
  redirect,
} from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { useAppForm } from '@/hooks/form'
import { FieldGroup } from '@/components/ui/field'
import OtpForm from '@/components/otp-form/OtpForm'
import { useRegisterRequest } from '@/lib/http/hooks/use-register-request'
import { useRegisterVerify } from '@/lib/http/hooks/use-register-verify'
import { useAuth } from '@/lib/auth/auth-provider'
import { hasSession } from '@/lib/auth/token-storage'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { GoogleGlyph } from '@/components/ui/google-glyph'
import { getGoogleConfigured } from '@/lib/auth/auth-mode'
import { startGoogleSignIn } from '@/lib/auth/social-sign-in'
import { toast } from 'sonner'

const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, "Name can't exceed 50 characters"),
  email: z.email('Please provide a valid email address'),
})

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    if (hasSession()) {
      throw redirect({ to: '/' })
    }
  },
  component: RegisterPage,
})

type Step = 'register' | 'verify'

function RegisterPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [step, setStep] = useState<Step>('register')
  const [googleBusy, setGoogleBusy] = useState(false)

  const googleConfigured = getGoogleConfigured()

  const registerMutation = useRegisterRequest()
  const verifyMutation = useRegisterVerify()

  const handleGoogleRegister = async () => {
    setGoogleBusy(true)
    const started = await startGoogleSignIn()
    if (!started) {
      toast.error('Could not start Google sign-in')
      setGoogleBusy(false)
    }
  }

  const handleRegisterSubmit = async (value: {
    name: string
    email: string
  }) => {
    const result = await registerMutation.mutateAsync(value)
    if (result.isOk()) {
      setStep('verify')
    }
  }

  const form = useAppForm({
    defaultValues: {
      name: '',
      email: '',
    },
    validators: {
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      await handleRegisterSubmit(value)
    },
  })

  const handleOtpSubmit = async (value: { otp: string }) => {
    const result = await verifyMutation.mutateAsync(value)
    if (result.isOk()) {
      auth.login()
      navigate({ to: '/' })
    }
  }

  return (
    <div
      className="bg-background flex min-h-screen items-center justify-center
        p-4"
    >
      <div className="w-full max-w-md">
        {step === 'register' ? (
          <div className="flex flex-col items-center space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <img src="/favicon.ico" alt="Logo" className="h-16 w-16" />
              <h1 className="text-foreground text-2xl font-semibold">
                Create your account
              </h1>
            </div>

            <form
              id="register-form"
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
              className="w-full space-y-6"
            >
              <FieldGroup>
                <form.AppField
                  name="name"
                  children={(field) => <field.TextField placeholder="Name" />}
                />
                <form.AppField
                  name="email"
                  children={(field) => (
                    <field.TextField placeholder="Email address" />
                  )}
                />
              </FieldGroup>

              <form.AppForm>
                <form.FormButton
                  enabledText="Create Account"
                  loadingText="Creating Account"
                  disabledText="Enter your details to register"
                  formId="register-form"
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
                  onClick={handleGoogleRegister}
                >
                  <GoogleGlyph />
                  {googleBusy
                    ? 'Redirecting to Google…'
                    : 'Continue with Google'}
                </Button>
              </>
            )}

            <div className="text-muted-foreground text-sm">
              Already have an account?{' '}
              <Link to="/login" className="cursor-pointer">
                <span className="text-primary hover:underline">Sign in →</span>
              </Link>
            </div>
          </div>
        ) : (
          <OtpForm
            title="Verify Your Email"
            onSubmit={handleOtpSubmit}
            linkProvider={({ children }) => (
              <span
                onClick={() => setStep('register')}
                className="cursor-pointer"
              >
                {children}
              </span>
            )}
          />
        )}
      </div>
    </div>
  )
}
