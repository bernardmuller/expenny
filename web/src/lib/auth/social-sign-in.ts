import { STORAGE_KEYS } from '@/lib/storage/storage-keys'

export const PENDING_OAUTH_KEY = STORAGE_KEYS.PENDING_OAUTH

/** Does this query string carry MCP/OIDC authorize params forwarded by better-auth? */
export function hasAuthorizeParams(params: URLSearchParams): boolean {
  return (
    params.has('client_id') ||
    params.has('redirect_uri') ||
    params.has('code_challenge')
  )
}

/**
 * Persist the authorize URL to return to once the user is signed in.
 *
 * better-auth's mcp plugin resumes the flow itself, but only when the response
 * that signs the user in also sets a fresh session cookie (its `after` hook
 * bails on `!hasSessionToken`). When it doesn't — an already-signed-in user, or
 * a path where we set the cookie ourselves — we have to resume it, which means
 * re-entering /auth/mcp/authorize. Storing the current /login URL instead would
 * just re-render the login page and strand the OAuth client waiting for a code.
 *
 * Called on mount when authorize params are present in the query string, and
 * before leaving for Google so the flow survives the full-page redirect.
 */
export function capturePendingOAuth(search: string): string | null {
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

export function consumePendingOAuth(): string | null {
  const url = sessionStorage.getItem(PENDING_OAUTH_KEY)
  if (url) sessionStorage.removeItem(PENDING_OAUTH_KEY)
  return url
}

/**
 * Start a Google sign-in, saving any pending MCP authorize first. Always
 * returns to `/login?resume=1`, whether the user started from /login or
 * /register — that route owns picking the pending authorize back up.
 *
 * Resolves `true` once the browser is on its way to Google, `false` if the
 * sign-in could not be started.
 */
export async function startGoogleSignIn(): Promise<boolean> {
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
      return true
    }
  } catch {
    // fall through — the caller reports the failure
  }
  return false
}
