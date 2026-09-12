import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { decodeJwt } from '@/lib/auth/decode-token'
import { getAccessToken } from '@/lib/auth/token-storage'
import { getAuthMode } from '@/lib/auth/auth-mode'
import { requireAuth } from '@/lib/auth/route-guard'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/profile/mcp-token')({
  beforeLoad: () => requireAuth(),
  component: McpTokenPage,
})

function McpTokenPage() {
  const router = useRouter()
  const [copied, setCopied] = useState<'token' | 'config' | null>(null)

  const isBetterAuth = getAuthMode() === 'better-auth'
  const tokenResult = getAccessToken()
  const token = tokenResult.isOk() ? tokenResult.value : null
  const payload = !isBetterAuth && token ? decodeJwt(token).unwrapOr(null) : null

  const expiresAt = payload?.exp
    ? new Date(payload.exp * 1000)
    : null

  const handleCopy = async (text: string, type: 'token' | 'config') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy — copy manually')
    }
  }

  const exampleConfig = JSON.stringify(
    {
      mcpServers: {
        expenny: {
          url: 'https://mcp.expenny.co.za/mcp',
          headers: {
            Authorization: 'Bearer <your-token>',
          },
        },
      },
    },
    null,
    2,
  )

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back onBack={() => router.history.back()} />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>MCP Access Token</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
        </AppHeader.Right>
      </AppHeader.Root>

      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Access Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Use this token to authenticate your MCP server connection. Paste
              it into your MCP client config as a Bearer token.
            </p>

            {isBetterAuth ? (
              <p className="text-muted-foreground text-sm">
                MCP access tokens are provisioned via OAuth client credentials.
                This page will show your registered client once OAuth issuance
                is enabled.
              </p>
            ) : token ? (
              <>
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Your Token
                  </p>
                  <div className="bg-muted [box-shadow:var(--input-groove)] relative rounded-lg p-3">
                    <code className="text-foreground block break-all font-mono text-xs leading-relaxed">
                      {token}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopy(token, 'token')}
                    >
                      {copied === 'token' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {expiresAt && (
                  <p className="text-muted-foreground text-xs">
                    Expires {expiresAt.toLocaleDateString()} at{' '}
                    {expiresAt.toLocaleTimeString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No access token found. Please log in again.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MCP Client Config</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Add this to your MCP client config and replace{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                {'<your-token>'}
              </code>{' '}
              with the token above.
            </p>
            <div className="bg-muted [box-shadow:var(--input-groove)] relative rounded-lg p-3">
              <pre className="text-foreground overflow-x-auto font-mono text-xs leading-relaxed">
                {exampleConfig}
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => handleCopy(exampleConfig, 'config')}
              >
                {copied === 'config' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <Separator />
            <p className="text-muted-foreground text-xs">
              This token expires in 24 hours. Return to this page to grab a
              fresh token when needed.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://modelcontextprotocol.io/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                MCP Docs
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </Layout>
    </>
  )
}
