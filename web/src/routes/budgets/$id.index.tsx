import { requireAuth } from '@/lib/auth/route-guard'
import { getBudgetByIdQueryOptions } from '@/lib/http/queries/budget-detail'
import { getBudgetRecurringExpensesQueryOptions } from '@/lib/http/queries/recurring-expenses/getBudgetRecurringExpenses'
import type { BudgetRecurringExpense } from '@/lib/http/queries/recurring-expenses/getBudgetRecurringExpenses'
import { getCategoriesQueryOptions } from '@/lib/http/queries/categories'
import RecurringExpensesCard from '@/components/recurring-expenses-card/RecurringExpensesCard'
import RecurringExpensesCardItem from '@/components/recurring-expenses-card/RecurringExpensesCardItem'
import RecurringExpensesCardDueTodayItem from '@/components/recurring-expenses-card/RecurringExpensesCardDueTodayItem'
import RecurringExpensesCardMarkPaidDialog from '@/components/recurring-expenses-card/RecurringExpensesCardMarkPaidDialog'
import RecurringExpensesCardUnmarkConfirm from '@/components/recurring-expenses-card/RecurringExpensesCardUnmarkConfirm'
import RecurringExpensesCardDeleteConfirm from '@/components/recurring-expenses-card/RecurringExpensesCardDeleteConfirm'
import { useUpdateRecurringExpenseStatus } from '@/lib/http/hooks/use-update-recurring-expense-status'
import { useDeleteRecurringExpenseInstance } from '@/lib/http/hooks/use-delete-recurring-expense-instance'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { formatDayOfMonth } from '@/lib/utils/formatting/formatDayOfMonth'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  useNavigate,
  Link,
  useRouter,
} from '@tanstack/react-router'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { BudgetDetailSkeleton } from './budgets.skeleton'
import PlannedBudgetBreakdownItem from '@/components/budget-breakdowns/PlannedBudgetBreakdownItem'
import OverBudgetBreakdownItem from '@/components/budget-breakdowns/OverBudgetBreakdownItem'
import UnplannedBudgetBreakdownItem from '@/components/budget-breakdowns/UnplannedBudgetBreakdownItem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrentBudgetWithoutAction } from '@/components/current-budget/CurrentBudget'
import { Button } from '@/components/ui/button'
import { usePrivacy } from '@/lib/hooks/usePrivacy'
import { getPrivacyDisplayValue } from '@/lib/utils/formatting/getPrivacyDisplayValue'
import { AppHeader } from '@/components/app-header'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NavigationLink } from '@/components/navigation-link/NavigationLink'
import { Plus, ReceiptText } from 'lucide-react'
import { Layout } from '@/components/layouts/Layout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/budgets/$id/')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        getBudgetByIdQueryOptions(params.id),
      ),
      context.queryClient.ensureQueryData(
        getBudgetRecurringExpensesQueryOptions(params.id),
      ),
      context.queryClient.ensureQueryData(getCategoriesQueryOptions()),
    ])
  },
  component: BudgetDetailPage,
})

function BudgetDetailPage() {
  return (
    <Suspense fallback={<BudgetDetailSkeleton />}>
      <BudgetDetail />
    </Suspense>
  )
}

const RECURRING_UNPAID_DEBOUNCE_MS = 200
const RECURRING_CYCLE_LENGTH = 31

function BudgetDetail() {
  const { id } = Route.useParams()
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: budget } = useSuspenseQuery(getBudgetByIdQueryOptions(id))
  const { data: recurringResponse } = useSuspenseQuery(
    getBudgetRecurringExpensesQueryOptions(id),
  )
  const { data: categoriesResponse } = useSuspenseQuery(
    getCategoriesQueryOptions(),
  )
  const updateRecurringStatusMutation = useUpdateRecurringExpenseStatus()
  const deleteRecurringMutation = useDeleteRecurringExpenseInstance()
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy()
  const [sortOption, setSortOption] = useState<string>('name-asc')

  const recurringInstances = recurringResponse.recurringExpenses
  const todayDay = new Date().getDate()
  const sortedRecurringInstances = useMemo(() => {
    const daysUntilDue = (raw: string | null) => {
      if (!raw) return Number.POSITIVE_INFINITY
      const day = parseInt(raw, 10)
      if (Number.isNaN(day)) return Number.POSITIVE_INFINITY
      const diff = day - todayDay
      return diff >= 0 ? diff : diff + RECURRING_CYCLE_LENGTH
    }
    return [...recurringInstances].sort(
      (a, b) => daysUntilDue(a.scheduledAt) - daysUntilDue(b.scheduledAt),
    )
  }, [recurringInstances, todayDay])
  const dueTodayCount = sortedRecurringInstances.filter(
    (i) =>
      !i.isPaid &&
      i.scheduledAt !== null &&
      parseInt(i.scheduledAt, 10) === todayDay,
  ).length
  const paidCount = sortedRecurringInstances.filter((i) => i.isPaid).length
  const unpaidCount = sortedRecurringInstances.length - paidCount
  const categoriesById = useMemo(
    () =>
      new Map(categoriesResponse.categories.map((c) => [c.id, c])),
    [categoriesResponse.categories],
  )
  const recurringCategoryOptions = useMemo(
    () =>
      categoriesResponse.categories.map((c) => ({
        value: c.id,
        label: `${c.icon} ${c.label}`,
      })),
    [categoriesResponse.categories],
  )

  const [markPaidTarget, setMarkPaidTarget] =
    useState<BudgetRecurringExpense | null>(null)
  const [pendingDelete, setPendingDelete] =
    useState<BudgetRecurringExpense | null>(null)
  const [pendingUnpaid, setPendingUnpaid] =
    useState<BudgetRecurringExpense | null>(null)
  const unpaidTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  const currentAmount = Math.floor(parseFloat(budget.budget.currentAmount))
  const startAmount = Math.floor(parseFloat(budget.budget.startAmount))
  const spentAmount = startAmount - currentAmount
  const spentPercentage = (spentAmount / startAmount) * 100

  const categories = budget.budget.categoryBreakdown

  useEffect(() => {
    if (budget.previous) {
      queryClient.prefetchQuery(getBudgetByIdQueryOptions(budget.previous))
    }
    if (budget.next) {
      queryClient.prefetchQuery(getBudgetByIdQueryOptions(budget.next))
    }
  }, [budget.previous, budget.next, queryClient])

  const handleCategoryClick = (categoryId: string) => {
    navigate({
      to: '/categories/$id',
      params: { id: categoryId },
    })
  }

  const handlePreviousBudget = () => {
    if (budget.previous) {
      navigate({ to: '/budgets/$id', params: { id: budget.previous } })
    }
  }

  const handleNextBudget = () => {
    if (budget.next) {
      navigate({ to: '/budgets/$id', params: { id: budget.next } })
    }
  }

  const handleRecurringToggle = (
    instance: BudgetRecurringExpense,
    nextChecked: boolean,
  ) => {
    if (nextChecked && !instance.isPaid) {
      setMarkPaidTarget(instance)
      return
    }
    if (!nextChecked && instance.isPaid) {
      setPendingUnpaid(instance)
    }
  }

  const handleConfirmUnpaid = () => {
    if (!pendingUnpaid) return
    const instance = pendingUnpaid
    setPendingUnpaid(null)
    const existing = unpaidTimers.current.get(instance.id)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      unpaidTimers.current.delete(instance.id)
      updateRecurringStatusMutation.mutate({
        budgetId: id,
        instanceId: instance.id,
        body: { isPaid: false },
      })
    }, RECURRING_UNPAID_DEBOUNCE_MS)
    unpaidTimers.current.set(instance.id, timer)
  }

  const handleMarkPaidSubmit = (
    instance: BudgetRecurringExpense,
    values: {
      description: string
      amount: number
      categoryId: string
      createdAt?: string
      note?: string
    },
  ) => {
    updateRecurringStatusMutation.mutate(
      {
        budgetId: id,
        instanceId: instance.id,
        body: { isPaid: true, expenseData: values },
      },
      {
        onSuccess: (result) => {
          if (result.isOk()) setMarkPaidTarget(null)
        },
      },
    )
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    const instance = pendingDelete
    setPendingDelete(null)
    deleteRecurringMutation.mutate({ budgetId: id, instanceId: instance.id })
  }

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back onBack={() => navigate({ to: '/dashboard' })} />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>Budget</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground
              aspect-square"
            onClick={() => router.navigate({ to: '/budgets/new' })}
          >
            <Plus className="h-5 w-5" />
            <span className="sr-only">New Budget</span>
          </Button>
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        <AppHeader.NavigationControls
          title={budget.budget.name}
          onPrevious={handlePreviousBudget}
          onNext={handleNextBudget}
          hasPrevious={!!budget.previous}
          hasNext={!!budget.next}
        />
        <CurrentBudgetWithoutAction
          budgetName={budget.budget.name}
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
        />
        {sortedRecurringInstances.length > 0 && (
          <RecurringExpensesCard
            paidCount={paidCount}
            unpaidCount={unpaidCount}
            dueTodayCount={dueTodayCount}
          >
            {sortedRecurringInstances.map((instance) => {
              const category = instance.categoryId
                ? categoriesById.get(instance.categoryId)
                : undefined
              const scheduledDay = instance.scheduledAt
                ? parseInt(instance.scheduledAt, 10)
                : null
              const isDueToday =
                scheduledDay !== null &&
                !Number.isNaN(scheduledDay) &&
                scheduledDay === todayDay
              const dueLabel =
                scheduledDay !== null && !Number.isNaN(scheduledDay)
                  ? formatDayOfMonth(scheduledDay)
                  : undefined
              const categoryLabel = category
                ? `${category.icon} ${category.label}`
                : '(deleted category)'
              const commonProps = {
                description: instance.description,
                amount: formatCurrency(parseFloat(instance.amount), 'za'),
                categoryLabel,
                isPaid: instance.isPaid,
                onToggle: (checked: boolean) =>
                  handleRecurringToggle(instance, checked),
                onDelete: instance.isPaid
                  ? undefined
                  : () => setPendingDelete(instance),
              }
              if (isDueToday && !instance.isPaid) {
                return (
                  <RecurringExpensesCardDueTodayItem
                    key={instance.id}
                    {...commonProps}
                  />
                )
              }
              return (
                <RecurringExpensesCardItem
                  key={instance.id}
                  {...commonProps}
                  dueLabel={dueLabel}
                />
              )
            })}
          </RecurringExpensesCard>
        )}
        <Card className="p-0">
          <NavigationLink
            icon={<ReceiptText className="h-5 w-5 text-white" />}
            title={`${budget.budget.expenses.length} Expenses`}
            subtitle={`Across ${categories.length} categories`}
            linkProvider={({ children }) => (
              <Link to="/budgets/$id/expenses" params={{ id }}>
                {children}
              </Link>
            )}
            variant="primary"
            active={budget.budget.isActive}
          />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">
                    Name
                    <span className="text-muted-foreground">A-Z</span>
                  </SelectItem>
                  <SelectItem value="name-desc">
                    Name <span className="text-muted-foreground">Z-A</span>
                  </SelectItem>
                  <SelectItem value="planned-asc">
                    Planned{' '}
                    <span className="text-muted-foreground">Low to High</span>
                  </SelectItem>
                  <SelectItem value="planned-desc">
                    Planned
                    <span className="text-muted-foreground">High to Low</span>
                  </SelectItem>
                  <SelectItem value="spent-asc">
                    Spent
                    <span className="text-muted-foreground">Low to High</span>
                  </SelectItem>
                  <SelectItem value="spent-desc">
                    Spent
                    <span className="text-muted-foreground">High to Low</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No category breakdowns available
                </div>
              )}
              {categories.length > 0 && (
                <div className="grid gap-3">
                  {categories
                    .sort((a, b) => {
                      switch (sortOption) {
                        case 'name-asc':
                          return a.label.localeCompare(b.label)
                        case 'name-desc':
                          return b.label.localeCompare(a.label)
                        case 'planned-asc': {
                          const aVal = a.allocated
                            ? parseFloat(a.allocated)
                            : -Infinity
                          const bVal = b.allocated
                            ? parseFloat(b.allocated)
                            : -Infinity
                          return aVal - bVal
                        }
                        case 'planned-desc': {
                          const aVal = a.allocated
                            ? parseFloat(a.allocated)
                            : -Infinity
                          const bVal = b.allocated
                            ? parseFloat(b.allocated)
                            : -Infinity
                          return bVal - aVal
                        }
                        case 'spent-asc':
                          return parseFloat(a.spent) - parseFloat(b.spent)
                        case 'spent-desc':
                          return parseFloat(b.spent) - parseFloat(a.spent)
                        default:
                          return a.label.localeCompare(b.label)
                      }
                    })
                    .map((category) => {
                      const spent = parseFloat(category.spent)
                      const allocated = category.allocated
                        ? parseFloat(category.allocated)
                        : null

                      const hasAllocation = allocated !== null && allocated > 0
                      const isOverBudget = hasAllocation && spent > allocated
                      const isUnplanned = !hasAllocation && spent > 0

                      if (isUnplanned) {
                        return (
                          <UnplannedBudgetBreakdownItem
                            name={category.label}
                            icon={category.icon}
                            spentAmount={formatCurrency(spent, 'za')}
                            onClick={() => handleCategoryClick(category.id)}
                          />
                        )
                      }
                      if (isOverBudget) {
                        return (
                          <OverBudgetBreakdownItem
                            name={category.label}
                            icon={category.icon}
                            plannedAmount={formatCurrency(allocated, 'za')}
                            spentAmount={formatCurrency(spent, 'za')}
                            onClick={() => handleCategoryClick(category.id)}
                          />
                        )
                      }
                      const percentage = hasAllocation
                        ? (spent / allocated) * 100
                        : 0
                      return (
                        <PlannedBudgetBreakdownItem
                          name={category.label}
                          icon={category.icon}
                          percentage={percentage}
                          plannedAmount={formatCurrency(
                            Math.floor(allocated!),
                            'za',
                          )}
                          spentAmount={formatCurrency(spent, 'za')}
                          onClick={() => handleCategoryClick(category.id)}
                        />
                      )
                    })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Layout>

      {markPaidTarget && (
        <RecurringExpensesCardMarkPaidDialog
          open
          onOpenChange={(open) => {
            if (!open) setMarkPaidTarget(null)
          }}
          categories={recurringCategoryOptions}
          isSubmitting={updateRecurringStatusMutation.isPending}
          defaultValues={{
            description: markPaidTarget.description,
            amount: parseFloat(markPaidTarget.amount),
            categoryId: markPaidTarget.categoryId ?? '',
          }}
          onSubmit={(values) =>
            handleMarkPaidSubmit(markPaidTarget, values)
          }
        />
      )}

      <RecurringExpensesCardUnmarkConfirm
        open={pendingUnpaid !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnpaid(null)
        }}
        description={pendingUnpaid?.description ?? ''}
        onConfirm={handleConfirmUnpaid}
      />

      <RecurringExpensesCardDeleteConfirm
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        description={pendingDelete?.description ?? ''}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
