import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth/route-guard'

export const Route = createFileRoute('/v2/')({
  beforeLoad: () => requireAuth(),
  component: V2Page,
})

type Me = {
  id: string
  name: string
  email: string
}

type State =
  | { status: 'loading' }
  | { status: 'ok'; user: Me }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }

function V2Page() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Relative so the Vite dev proxy forwards /v2 to the Go API
        // (http://localhost:5420) on the same origin; the session cookie rides
        // along and no CORS applies.
        const res = await fetch('/v2/me', { credentials: 'include' })

        if (cancelled) return

        if (res.status === 401) {
          setState({ status: 'unauthorized' })
          return
        }

        if (!res.ok) {
          setState({ status: 'error', message: `Unexpected status ${res.status}` })
          return
        }

        const user = (await res.json()) as Me
        setState({ status: 'ok', user })
      } catch (err) {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Request failed',
        })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">v2 session check</h1>
        <p className="text-muted-foreground text-sm">
          Calls <code>GET /v2/me</code> on the Go API and renders the result.
        </p>
      </div>

      {state.status === 'loading' && <p>Checking session…</p>}

      {state.status === 'unauthorized' && (
        <p className="text-destructive">
          Go API rejected the session (401). The cookie did not validate.
        </p>
      )}

      {state.status === 'error' && (
        <p className="text-destructive">Request failed: {state.message}</p>
      )}

      {state.status === 'ok' && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border p-4">
          <dt className="text-muted-foreground">id</dt>
          <dd className="font-mono">{state.user.id}</dd>
          <dt className="text-muted-foreground">name</dt>
          <dd>{state.user.name}</dd>
          <dt className="text-muted-foreground">email</dt>
          <dd>{state.user.email}</dd>
        </dl>
      )}
    </div>
  )
}
