import {
	createFileRoute,
	Link,
	useNavigate,
	redirect,
} from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import LoginForm from '@/components/login-form/LoginForm'
import OtpForm from '@/components/otp-form/OtpForm'
import { useLoginRequest } from '@/lib/http/hooks/use-login-request'
import { useLoginVerify } from '@/lib/http/hooks/use-login-verify'
import { useAuth } from '@/lib/auth/auth-provider'
import { hasTokens } from '@/lib/auth/token-storage'
import { bootstrapSessionFromCookie } from '@/lib/auth/session-sync'
import { STORAGE_KEYS } from '@/lib/storage/storage-keys'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getGoogleConfigured } from '@/lib/auth/auth-mode'
import { toast } from 'sonner'

const PENDING_OAUTH_KEY = STORAGE_KEYS.PENDING_OAUTH

/**
 * Persist the authorize URL to return to once the user is signed in.
 *
 * better-auth's mcp plugin resumes the flow itself, but only when the response
 * that signs the user in also sets a fresh session cookie (its `after` hook
 * bails on `!hasSessionToken`). When it doesn't — an already-signed-in user, or
 * a path where we set the cookie ourselves — we have to resume it, which means
 * re-entering /auth/mcp/authorize. Storing the current /login URL instead would
 * just re-render this page and strand the OAuth client waiting for a code.
 *
 * Called on mount when authorize params are present in the query string.
 */
function capturePendingOAuth(search: string): string | null {
	const params = new URLSearchParams(search)
	// better-auth's mcp plugin redirects to loginPage with these params
	if (hasAuthorizeParams(params)) {
		params.delete('resume')
		const apiUrl = import.meta.env.VITE_API_URL ?? ''
		const resumeUrl = `${apiUrl}/auth/mcp/authorize?${params.toString()}`
		sessionStorage.setItem(PENDING_OAUTH_KEY, resumeUrl)
		return resumeUrl
	}
	return sessionStorage.getItem(PENDING_OAUTH_KEY)
}

function consumePendingOAuth(): string | null {
	const url = sessionStorage.getItem(PENDING_OAUTH_KEY)
	if (url) sessionStorage.removeItem(PENDING_OAUTH_KEY)
	return url
}

/** Does this query string carry MCP/OIDC authorize params forwarded by better-auth? */
function hasAuthorizeParams(params: URLSearchParams): boolean {
	return (
		params.has('client_id') ||
		params.has('redirect_uri') ||
		params.has('code_challenge')
	)
}

/** better-auth error codes, as they arrive on `?error=`. */
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
		// Stay here only while genuinely mid-flow: an MCP authorize forwarded us
		// here, or a social sign-in is returning to finish. Everyone else with
		// tokens goes home. Deliberately not keyed off the stored pending URL —
		// better-auth's `after` hook often completes the authorize without ever
		// coming back through /login, which leaves that entry behind and would
		// strand a signed-in user on the login form.
		const isMidOAuth =
			hasAuthorizeParams(params) || params.get('resume') === '1'
		if (hasTokens() && !isMidOAuth) {
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

	// On mount: report any OAuth failure, resume a pending MCP authorize, or
	// finish a plain Google sign-in that returned to /login?resume=1.
	useEffect(() => {
		const search = window.location.search
		const params = new URLSearchParams(search)

		const error = params.get('error')
		if (error) {
			// better-auth redirects every OAuth callback failure back here.
			toast.error(oauthErrorMessage(error))
			sessionStorage.removeItem(PENDING_OAUTH_KEY)
			navigate({ to: '/login', replace: true })
			return
		}

		if (params.get('resume') === '1') {
			// Google sign-in returned here; the session cookie is now set.
			const resumeUrl = consumePendingOAuth()
			if (resumeUrl) {
				window.location.href = resumeUrl
				return
			}
			// No MCP authorize to resume — a plain sign-in. beforeLoad has normally
			// redirected already; this covers the bootstrap in main.tsx having lost
			// the race or failed.
			void bootstrapSessionFromCookie().then(() => {
				if (hasTokens()) {
					auth.login()
					navigate({ to: '/' })
				} else {
					toast.error('Sign-in did not complete. Please try again.')
				}
			})
			return
		}

		// Capture any fresh authorize params forwarded by better-auth
		const pending = capturePendingOAuth(search)

		// Already signed in when the authorize arrived — there is nothing to ask
		// for, so hand straight back to better-auth, which will see the session
		// cookie and issue the code.
		if (pending && hasAuthorizeParams(params) && hasTokens()) {
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

	const handleOtpSubmit = async (value: { otp: string }) => {
		const result = await verifyMutation.mutateAsync(value)
		if (result.isOk()) {
			auth.login()
			const resumeUrl = consumePendingOAuth()
			if (resumeUrl) {
				// Real navigation — the API needs to see the freshly-set session cookie
				window.location.href = resumeUrl
			} else {
				navigate({ to: '/' })
			}
		}
	}

	const handleGoogleLogin = async () => {
		setGoogleBusy(true)
		// Ensure any current authorize params are saved before we leave the page
		capturePendingOAuth(window.location.search)
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL ?? ''}/auth/sign-in/social`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						provider: 'google',
						// After Google, come back to /login?resume=1 so we pick up
						// PENDING_OAUTH and navigate to the authorize resume URL.
						callbackURL: `${window.location.origin}/login?resume=1`,
						// Failures after the state check land back in the app too.
						errorCallbackURL: `${window.location.origin}/login`,
					}),
				},
			)
			const data = (await res.json()) as { url?: string } | undefined
			if (res.ok && data?.url) {
				window.location.href = data.url
				return
			}
			toast.error('Could not start Google sign-in')
		} catch {
			toast.error('Could not start Google sign-in')
		}
		setGoogleBusy(false)
	}

	return (
		<div
			className="bg-background flex min-h-screen items-center justify-center
        p-4"
		>
			<div className="w-full max-w-md">
				{step === 'login' ? (
					<div className="space-y-6">
						{googleConfigured && (
							<>
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
								<div className="flex items-center gap-3">
									<Separator className="flex-1" />
									<span className="text-muted-foreground text-xs uppercase">
										or
									</span>
									<Separator className="flex-1" />
								</div>
							</>
						)}
						<LoginForm
							onSubmit={handleLoginSubmit}
							linkProvider={({ children }) => (
								<Link to="/register" className="cursor-pointer">
									{children}
								</Link>
							)}
						/>
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
								<span onClick={() => setStep('login')} className="cursor-pointer">
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

function GoogleGlyph() {
	return (
		<svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
			<path
				fill="#EA4335"
				d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
			/>
			<path
				fill="#4285F4"
				d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
			/>
			<path
				fill="#FBBC05"
				d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
			/>
			<path
				fill="#34A853"
				d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
			/>
		</svg>
	)
}
