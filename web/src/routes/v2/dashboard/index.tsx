import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { requireAuth } from '@/lib/auth/route-guard'
import { getActiveBudgetQueryOptions } from '@/lib/http/queries/budget'
import { getStatementCategoriesQueryOptions } from '@/lib/http/v2/queries/categories'
import { getMeQueryOptions } from '@/lib/http/v2/queries/me'
import { getStatementTransactionsQueryOptions } from '@/lib/http/v2/queries/statements'

import { Dashboard } from './-dashboard'
import { DashboardSkeleton } from './-skeleton'

export const Route = createFileRoute('/v2/dashboard/')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    context.queryClient.prefetchQuery(getActiveBudgetQueryOptions())
    context.queryClient.prefetchQuery(getStatementTransactionsQueryOptions())
    context.queryClient.prefetchQuery(getStatementCategoriesQueryOptions())
    await context.queryClient.ensureQueryData(getMeQueryOptions())
  },
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  )
}
