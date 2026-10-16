import { Suspense } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import RecurringExpenseTemplateList from '@/components/recurring-expense-template-list/RecurringExpenseTemplateList'
import { requireAuth } from '@/lib/auth/route-guard'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { getUserRecurringExpensesQueryOptions } from '@/lib/http/queries/recurring-expenses/getUserRecurringExpenses'
import { getCategoriesQueryOptions } from '@/lib/http/queries/categories'

export const Route = createFileRoute('/archive/profile/recurring-expenses')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    const userIdResult = getUserIdFromAccessToken()
    if (userIdResult.isErr()) return
    const userId = userIdResult.value
    await Promise.all([
      context.queryClient.ensureQueryData(
        getUserRecurringExpensesQueryOptions(userId),
      ),
      context.queryClient.ensureQueryData(getCategoriesQueryOptions()),
    ])
  },
  component: RecurringExpensesProfilePage,
})

function RecurringExpensesProfilePage() {
  const router = useRouter()
  const userIdResult = getUserIdFromAccessToken()

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back onBack={() => router.history.back()} />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>Recurring Expenses</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        {userIdResult.isOk() ? (
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <RecurringExpenseTemplateList userId={userIdResult.value} />
          </Suspense>
        ) : (
          <p className="text-muted-foreground text-sm">
            Unable to load your recurring expenses.
          </p>
        )}
      </Layout>
    </>
  )
}
