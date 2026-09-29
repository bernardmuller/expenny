import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { requireAuth } from '@/lib/auth/route-guard'
import { Check, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/profile/mcp-token')({
  beforeLoad: () => requireAuth(),
  component: McpPage,
})

const MCP_URL = 'https://mcp.expenny.co.za/mcp'
const CLAUDE_CMD = `claude mcp add --transport http expenny ${MCP_URL}`
const CURSOR_CONFIG = JSON.stringify(
  {
    mcpServers: {
      expenny: { url: MCP_URL },
    },
  },
  null,
  2,
)

interface OAuthConsent {
  id: string
  clientId: string
  scopes: string
  createdAt: string
}

function useMcpClients() {
  return useQuery<OAuthConsent[]>({
    queryKey: ['mcp-clients'],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/auth/oauth2/list-consents`,
        { credentials: 'include' },
      )
      if (!res.ok) return []
      return (await res.json()) as OAuthConsent[]
    },
  })
}

function useRevokeConsent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/auth/oauth2/revoke-consent`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        },
      )
      if (!res.ok) throw new Error('Failed to revoke')
    },
    onSuccess: () => {
      toast.success('Client revoked')
      qc.invalidateQueries({ queryKey: ['mcp-clients'] })
    },
    onError: () => toast.error('Could not revoke client'),
  })
}

function McpPage() {
  const router = useRouter()
  const [copied, setCopied] = useState<'cmd' | 'cursor' | null>(null)
  const { data: clients = [] } = useMcpClients()
  const revoke = useRevokeConsent()

  const handleCopy = async (text: string, type: 'cmd' | 'cursor') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy — copy manually')
    }
  }

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back onBack={() => router.history.back()} />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>MCP Connection</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
        </AppHeader.Right>
      </AppHeader.Root>

      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Connect an MCP client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Expenny supports the Model Context Protocol (MCP) over OAuth 2.0.
              Your MCP client will open a login page automatically — no tokens
              to copy.
            </p>

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Claude Desktop / claude CLI
              </p>
              <div className="bg-muted [box-shadow:var(--input-groove)] relative rounded-lg p-3">
                <code className="text-foreground block break-all font-mono text-xs leading-relaxed">
                  {CLAUDE_CMD}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => handleCopy(CLAUDE_CMD, 'cmd')}
                >
                  {copied === 'cmd' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Cursor / other MCP clients (mcp.json)
              </p>
              <div className="bg-muted [box-shadow:var(--input-groove)] relative rounded-lg p-3">
                <pre className="text-foreground overflow-x-auto font-mono text-xs leading-relaxed">
                  {CURSOR_CONFIG}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => handleCopy(CURSOR_CONFIG, 'cursor')}
                >
                  {copied === 'cursor' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

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

        <Card>
          <CardHeader>
            <CardTitle>Authorised clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clients.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No MCP clients have been authorised yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {clients.map((c) => (
                  <li key={c.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs">{c.clientId}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {c.scopes}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-7 w-7 shrink-0"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(c.clientId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Separator className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Layout>
    </>
  )
}
