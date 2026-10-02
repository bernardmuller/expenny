import AddExpenseForm from '@/components/add-expense-form/AddExpenseForm'
import {
  CurrentBudget,
  CurrentBudgetWithBadge,
} from '@/components/current-budget/CurrentBudget'
import { Layout } from '@/components/layouts/Layout'
import RecentExpenses from '@/components/recent-expenses/RecentExpenses'
import { RefreshIndicator } from '@/components/refresh-indicator/RefreshIndicator'
import { requireAuth } from '@/lib/auth/route-guard'
import { useCreateTransaction } from '@/lib/http/hooks/use-create-transaction'
import { getActiveBudgetQueryOptions } from '@/lib/http/queries/budget'
import { getCategoriesQueryOptions } from '@/lib/http/queries/categories'
import { getUserStreakQueryOptions } from '@/lib/http/queries/streak/getUserStreak'
import { getUserByIdQueryOptions } from '@/lib/http/queries/users/getUserById'
import { StreakGraph } from '@/components/streak-graph'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Confetti } from '@/components/confetti/Confetti'
import { DashboardSkeleton } from './dashboard.skeleton'
import RecentExpense from '@/components/recent-expenses/RecentExpense'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { User } from 'lucide-react'
import { useDeleteExpense } from '@/lib/http/hooks/use-delete-expense'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { usePrivacy } from '@/lib/hooks/usePrivacy'
import { getPrivacyDisplayValue } from '@/lib/utils/formatting/getPrivacyDisplayValue'
import { AppHeader } from '@/components/app-header'
import { differenceInCalendarDays, format } from 'date-fns'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    context.queryClient.prefetchQuery(getActiveBudgetQueryOptions())
    context.queryClient.prefetchQuery(getCategoriesQueryOptions())
    await context.queryClient.ensureQueryData(getUserByIdQueryOptions())
    const userIdResult = getUserIdFromAccessToken()
    if (userIdResult.isOk()) {
      context.queryClient.prefetchQuery(
        getUserStreakQueryOptions(userIdResult.value),
      )
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const router = useRouter()
  const data = useSuspenseQuery(getUserByIdQueryOptions())
  const active = useQuery(getActiveBudgetQueryOptions())

  if (!data.data.onboarded && !active.data) {
    router.navigate({ to: '/onboarding' })
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  )
}

function Dashboard() {
  const location = useLocation()
  const { data: budget, isFetching: budgetFetching } = useSuspenseQuery(
    getActiveBudgetQueryOptions(),
  )
  const { data: categories, isFetching: categoriesFetching } = useSuspenseQuery(
    getCategoriesQueryOptions(),
  )
  const { data: user } = useSuspenseQuery(getUserByIdQueryOptions())
  const userIdResult = getUserIdFromAccessToken()
  const streak = useQuery({
    ...getUserStreakQueryOptions(
      userIdResult.isOk() ? userIdResult.value : '',
    ),
    enabled: userIdResult.isOk(),
  })
  const createTransactionMutation = useCreateTransaction(budget.id)
  const deleteExpenseMutation = useDeleteExpense()
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy()
  const isRefreshing = useMemo(
    () => (budgetFetching || categoriesFetching) && categories,
    [categories, budgetFetching, categoriesFetching],
  )
  const [showConfetti, setShowConfetti] = useState(false)

  const currentAmount = Math.floor(parseFloat(budget.currentAmount))
  const startAmount = Math.floor(parseFloat(budget.startAmount))
  const spentAmount = startAmount - currentAmount
  const spentPercentage = (spentAmount / startAmount) * 100

  useEffect(() => {
    const state = location.state as { showConfetti?: boolean } | undefined
    if (state?.showConfetti) {
      setShowConfetti(true)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  return (
    <>
      {showConfetti && <Confetti />}
      <RefreshIndicator isRefreshing={!!isRefreshing} />
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Icon src="/favicon.ico" alt="App Icon" />
          <AppHeader.Info appName="Expenny" message={`Hi, ${user.name}!`} />
        </AppHeader.Left>
        <div />
        <AppHeader.Right>
          {streak.data && (
            <Link to="/profile" aria-label="View streak">
              <StreakGraph.Badge count={streak.data.currentStreak} />
            </Link>
          )}
          <ThemeToggle />
          <Button
            variant="ghost"
            asChild
            className="text-muted-foreground aspect-square"
          >
            <Link to="/profile">
              <User className="h-5 w-5" />
              <span className="sr-only">Profile</span>
            </Link>
          </Button>
        </AppHeader.Right>
      </AppHeader.Root>

      <Layout>
        {budget.endDate ? (
          <CurrentBudgetWithBadge
            budgetName={budget.name}
            currentAmount={getPrivacyDisplayValue(
              formatCurrency(currentAmount, 'za'),
              isPrivacyEnabled,
            )}
            startingAmount={getPrivacyDisplayValue(
              formatCurrency(startAmount, 'za'),
              isPrivacyEnabled,
            )}
            spentAmount={getPrivacyDisplayValue(
              formatCurrency(spentAmount, 'za'),
              isPrivacyEnabled,
            )}
            spentPercentage={spentPercentage}
            onClick={togglePrivacy}
            linkProvider={({ children }) => (
              <Link to="/budgets/$id" params={{ id: budget.id }}>
                {children}
              </Link>
            )}
            daysLeft={differenceInCalendarDays(
              new Date(budget.endDate),
              new Date(),
            )}
          />
        ) : (
          <CurrentBudget
            budgetName={budget.name}
            currentAmount={getPrivacyDisplayValue(
              formatCurrency(currentAmount, 'za'),
              isPrivacyEnabled,
            )}
            startingAmount={getPrivacyDisplayValue(
              formatCurrency(startAmount, 'za'),
              isPrivacyEnabled,
            )}
            spentAmount={getPrivacyDisplayValue(
              formatCurrency(spentAmount, 'za'),
              isPrivacyEnabled,
            )}
            spentPercentage={spentPercentage}
            onClick={togglePrivacy}
            linkProvider={({ children }) => (
              <Link to="/budgets/$id" params={{ id: budget.id }}>
                {children}
              </Link>
            )}
          />
        )}
        <AddExpenseForm
          onSubmit={(value) =>
            createTransactionMutation.mutate({
              description: value.description,
              amount: value.amount,
              categoryId: value.category,
              createdAt: value.createdAt,
              note: value.note,
            })
          }
          categories={categories.categories
            .map((c) => ({
              label: c.label,
              value: c.id,
            }))
            .sort((a, b) => a.label.localeCompare(b.label))}
        />
        <RecentExpenses
          linkProvider={({ children }) => (
            <Link to="/budgets/$id/expenses" params={{ id: budget.id }}>
              {children}
            </Link>
          )}
        >
          {budget.expenses.length === 0 && (
            <div className="text-muted-foreground p-8 text-center text-sm">
              No recent expenses
            </div>
          )}
          {budget.expenses.length > 0 && (
            <div className="flex flex-col gap-2">
              {budget.expenses.slice(0, 5).map((expense) => (
                <RecentExpense
                  key={expense.id}
                  amount={formatCurrency(parseFloat(expense.amount), 'za')}
                  description={expense.description}
                  emoji={expense.category.icon}
                  categoryLabel={expense.category.label}
                  onDelete={() => {
                    deleteExpenseMutation.mutate({
                      budgetId: budget.id,
                      expenseId: expense.id,
                    })
                  }}
                  createdAt={format(
                    new Date(expense.createdAt),
                    'dd MMMM yyyy',
                  )}
                />
              ))}
            </div>
          )}
        </RecentExpenses>
      </Layout>
    </>
  )
}
