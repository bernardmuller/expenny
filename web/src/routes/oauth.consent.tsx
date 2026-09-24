import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { requireAuth } from '@/lib/auth/route-guard'
import { z } from 'zod'
import { toast } from 'sonner'

const searchSchema = z.object({
  client_id: z.string().optional(),
  scope: z.string().optional(),
  consent_code: z.string().optional(),
})

export const Route = createFileRoute('/oauth/consent')({
  beforeLoad: () => requireAuth(),
  validateSearch: searchSchema,
  component: ConsentPage,
})

function ConsentPage() {
  const navigate = useNavigate()
  const { client_id, scope, consent_code } = Route.useSearch()
  const [busy, setBusy] = useState(false)

  const scopes = scope?.split(' ').filter(Boolean) ?? []

  const handleConsent = async (accept: boolean) => {
    if (!consent_code) {
      toast.error('Invalid consent request — missing consent_code')
      return
    }

    setBusy(true)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/auth/oauth2/consent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ accept, consent_code }),
        },
      )

      if (!res.ok) {
        const text = await res.text()
        toast.error(`Consent failed: ${text}`)
        setBusy(false)
        return
      }

      const data = (await res.json()) as { redirectURI?: string }
      if (data.redirectURI) {
        window.location.href = data.redirectURI
      } else {
        // Denied path — go back to the dashboard
        navigate({ to: '/' })
      }
    } catch {
      toast.error('Could not process consent request')
      setBusy(false)
    }
  }

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Center>
          <AppHeader.Title>Authorize Access</AppHeader.Title>
        </AppHeader.Center>
      </AppHeader.Root>

      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>
              {client_id
                ? `"${client_id}" wants access`
                : 'An application wants access'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              This application is requesting the following permissions on your
              Expenny account.
            </p>

            {scopes.length > 0 && (
              <ul className="space-y-1">
                {scopes.map((s) => (
                  <li
                    key={s}
                    className="bg-muted rounded-md px-3 py-1.5 font-mono text-xs"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => handleConsent(true)}
              >
                Allow
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => handleConsent(false)}
              >
                Deny
              </Button>
            </div>

            <p className="text-muted-foreground text-xs">
              You can revoke access at any time from your profile settings.
            </p>
          </CardContent>
        </Card>
      </Layout>
    </>
  )
}
