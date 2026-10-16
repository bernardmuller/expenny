import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { requireAuth } from '@/lib/auth/route-guard'
import { getBudgetQueryOptions } from '@/lib/http/v2/queries/budget'
import {
  getCategoryGroupsQueryOptions,
  getStatementCategoriesQueryOptions,
} from '@/lib/http/v2/queries/categories'
import { getCorrectionsQueryOptions } from '@/lib/http/v2/queries/corrections'
import { getMeQueryOptions } from '@/lib/http/v2/queries/me'
import { getStatementTransactionsQueryOptions } from '@/lib/http/v2/queries/statements'

import { Dashboard } from './-dashboard'
import { DashboardSkeleton } from './-skeleton'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    context.queryClient.prefetchQuery(getBudgetQueryOptions())
    context.queryClient.prefetchInfiniteQuery(
      getStatementTransactionsQueryOptions(),
    )
    context.queryClient.prefetchQuery(getStatementCategoriesQueryOptions())
    context.queryClient.prefetchQuery(getCategoryGroupsQueryOptions())
    context.queryClient.prefetchQuery(getCorrectionsQueryOptions())
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
