import { requireAuth } from '@/lib/auth/route-guard'
import {
  getCategoryExpensesTimeseriesQueryOptions,
  getCategoryExpensesBudgetTimeseriesQueryOptions,
  transformMonthTimeseriesData,
  transformBudgetTimeseriesData,
} from '@/lib/http/queries/categories/getCategoryExpensesTimeseries'
import { getCategoryExpensesQueryOptions } from '@/lib/http/queries/categories/getCategoryExpenses'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Suspense, useState, useEffect } from 'react'
import { CategoryDetailSkeleton } from './categories.skeleton'
import { AppHeader } from '@/components/app-header'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Layout } from '@/components/layouts/Layout'
import CategoryChart from '@/components/category-chart/CategoryChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import RecentExpense from '@/components/recent-expenses/RecentExpense'
import { format, isSameMonth } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X } from 'lucide-react'
import type { MonthlyChartData } from '@/components/category-chart/CategoryChart.types'

export const Route = createFileRoute('/archive/categories/$id')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        getCategoryExpensesBudgetTimeseriesQueryOptions(params.id, 6),
      ),
      context.queryClient.ensureQueryData(
        getCategoryExpensesTimeseriesQueryOptions(params.id, 6),
      ),
      context.queryClient.ensureQueryData(
        getCategoryExpensesQueryOptions(params.id),
      ),
    ])
  },
  component: CategoryDetailPage,
})

function CategoryDetailPage() {
  return (
    <Suspense fallback={<CategoryDetailSkeleton />}>
      <CategoryDetail />
    </Suspense>
  )
}

function CategoryDetail() {
  const { id } = Route.useParams()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'budget' | 'month'>('budget')
  const [activeFilter, setActiveFilter] = useState<{
    type: 'budget' | 'month'
    id: string
    label: string
  } | null>(null)

  const { data: budgetTimeseriesData } = useSuspenseQuery(
    getCategoryExpensesBudgetTimeseriesQueryOptions(id, 6),
  )
  const { data: monthTimeseriesData } = useSuspenseQuery(
    getCategoryExpensesTimeseriesQueryOptions(id, 6),
  )
  const { data: expensesData } = useSuspenseQuery(
    getCategoryExpensesQueryOptions(id),
  )

  const category = expensesData.expenses[0]?.category
  const categoryName = category?.label || 'Category'
  const categoryIcon = category?.icon || '📊'

  const chartData =
    viewMode === 'budget'
      ? transformBudgetTimeseriesData(budgetTimeseriesData)
      : transformMonthTimeseriesData(monthTimeseriesData)

  const chartDescription =
    viewMode === 'budget'
      ? 'Total Spent vs Allocated Budget per Period'
      : 'Monthly Spending Across All Budgets'

  useEffect(() => {
    setActiveFilter(null)
  }, [viewMode])

  const handleBarClick = (data: MonthlyChartData) => {
    if (viewMode === 'budget' && data.budgetId) {
      setActiveFilter({
        type: 'budget',
        id: data.budgetId,
        label: data.month,
      })
    } else if (viewMode === 'month' && data.period) {
      setActiveFilter({
        type: 'month',
        id: data.period,
        label: data.month,
      })
    }
  }

  const filteredExpenses = expensesData.expenses.filter((expense) => {
    if (!activeFilter) return true

    if (activeFilter.type === 'budget') {
      return expense.budgetId === activeFilter.id
    } else {
      return isSameMonth(new Date(expense.createdAt), new Date(activeFilter.id))
    }

    return true
  })

  const totalAmount = filteredExpenses.reduce(
    (sum, expense) => sum + parseFloat(expense.amount),
    0,
  )

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back onBack={() => router.history.back()} />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>Category</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        <Tabs
          value={viewMode}
          onValueChange={(value) => setViewMode(value as 'budget' | 'month')}
        >
          <TabsList className="w-full">
            <TabsTrigger value="budget">By Budget</TabsTrigger>
            <TabsTrigger value="month">By Month</TabsTrigger>
          </TabsList>
          <TabsContent value={viewMode}>
            <CategoryChart
              data={
                viewMode === 'budget' ? [...chartData] : chartData.reverse()
              }
              categoryName={`${categoryIcon} ${categoryName}`}
              description={chartDescription}
              currency="R"
              onBarClick={handleBarClick}
            />
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Category Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {activeFilter && (
              <div
                className="bg-muted mb-4 flex items-center justify-between
                  rounded-md p-3"
              >
                <span className="text-sm">
                  Showing expenses for:{' '}
                  <strong className="font-semibold">
                    {activeFilter.label}
                  </strong>
                </span>
                <button
                  onClick={() => setActiveFilter(null)}
                  aria-label="Clear filter"
                  className="text-muted-foreground hover:text-foreground
                    transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {filteredExpenses.length === 0 && (
              <div className="text-muted-foreground p-8 text-center text-sm">
                {expensesData.expenses.length === 0
                  ? 'No expenses found for this category'
                  : activeFilter
                    ? `No expenses found for ${activeFilter.label}`
                    : 'No expenses found'}
              </div>
            )}

            {filteredExpenses.length > 0 && (
              <>
                <div className="flex flex-col gap-1 py-2">
                  {filteredExpenses.map((expense) => (
                    <RecentExpense
                      key={expense.id}
                      amount={formatCurrency(parseFloat(expense.amount), 'za')}
                      description={expense.description}
                      emoji={expense.category.icon}
                      categoryLabel={expense.category.label}
                      createdAt={format(expense.createdAt, 'dd MMMM yyyy')}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-muted-foreground font-medium">
                    Total
                  </span>
                  <span className="text-foreground font-semibold">
                    {formatCurrency(totalAmount, 'za')}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </Layout>
    </>
  )
}
