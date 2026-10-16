import { Layout } from '@/components/layouts/Layout'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link, useRouter } from '@tanstack/react-router'
import { UserCircle, AlertCircle, User } from 'lucide-react'

export function ErrorBoundary() {
  const router = useRouter()

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Icon src="/favicon.ico" alt="App Icon" />
          <AppHeader.Info
            appName="Expense Tracker"
            message="Something went wrong"
          />
        </AppHeader.Left>
        <div />
        <AppHeader.Right>
          <Button
            variant="ghost"
            asChild
            className="text-muted-foreground aspect-square"
          >
            <Link to="/archive/profile">
              <User className="h-5 w-5" />
              <span className="sr-only">Profile</span>
            </Link>
          </Button>
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="text-destructive h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We encountered an unexpected error. Please try again.
            </p>
            <Button
              onClick={() => router.navigate({ to: '/dashboard' })}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </Layout>
    </>
  )
}
