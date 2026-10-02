import AllExpenses from '@/components/all-expenses/AllExpenses'
import { AppHeader } from '@/components/app-header'
import RecentExpense from '@/components/recent-expenses/RecentExpense'
import { requireAuth } from '@/lib/auth/route-guard'
import { getBudgetExpensesQueryOptions } from '@/lib/http/queries/budgets/getBudgetExpenses'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useState } from 'react'
import { BudgetExpensesSkeleton } from './budgets.expenses.skeleton'
import { Input } from '@/components/ui/input'
import { z } from 'zod'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDeleteExpense } from '@/lib/http/hooks/use-delete-expense'
import { Layout } from '@/components/layouts/Layout'
import { format } from 'date-fns'
import { Label } from '@/components/ui/label'

const expensesSearchSchema = z.object({
  category: z.string().optional(),
})

export const Route = createFileRoute('/budgets/$id/expenses')({
  beforeLoad: () => requireAuth(),
  validateSearch: expensesSearchSchema,
  loader: ({ context, params }) => {
    context.queryClient.prefetchQuery(getBudgetExpensesQueryOptions(params.id))
  },
  component: BudgetExpensesPage,
})

function BudgetExpensesPage() {
  return (
    <Suspense fallback={<BudgetExpensesSkeleton />}>
      <BudgetExpenses />
    </Suspense>
  )
}

function BudgetExpenses() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()
  const searchParams = Route.useSearch()
  const { data: budget } = useSuspenseQuery(getBudgetExpensesQueryOptions(id))
  const [filterValue, setFilterValue] = useState(searchParams.category ?? '')
  const [sortOption, setSortOption] = useState<string>('default')
  const deleteExpenseMutation = useDeleteExpense()

  const filteredExpenses = budget.expenses
    .filter((expense) => {
      if (!filterValue.trim()) return true
      const searchTerm = filterValue.toLowerCase()
      return (
        expense.category.label.toLowerCase().includes(searchTerm) ||
        expense.description.toLowerCase().includes(searchTerm)
      )
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'amount-asc':
          return parseFloat(a.amount) - parseFloat(b.amount)
        case 'amount-desc':
          return parseFloat(b.amount) - parseFloat(a.amount)
        case 'description-asc':
          return a.description.localeCompare(b.description)
        case 'description-desc':
          return b.description.localeCompare(a.description)
        case 'default':
        default:
          // Preserve original order (by createdAt)
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
      }
    })

  const handleFilterChange = (value: string) => {
    setFilterValue(value)
    if (!value.trim()) {
      navigate({
        to: '/budgets/$id/expenses',
        params: { id },
        search: {},
      })
    }
  }

  const totalAmount = filteredExpenses.reduce(
    (sum, expense) => sum + parseFloat(expense.amount),
    0,
  )

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back
            onBack={() => navigate({ to: '/budgets/$id', params: { id } })}
          />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>Expenses</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        <AllExpenses budgetName={budget.name}>
          <div>
            <Label className="pb-2">Search</Label>
            <Input
              type="text"
              placeholder="Expense name.."
              value={filterValue}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={sortOption} onValueChange={setSortOption}>
            <Label className="py-2">Sort by</Label>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                Date <span className="text-muted-foreground">(default)</span>
              </SelectItem>
              <SelectItem value="amount-asc">
                Amount{' '}
                <span className="text-muted-foreground">Low to High</span>
              </SelectItem>
              <SelectItem value="amount-desc">
                Amount{' '}
                <span className="text-muted-foreground">High to Low</span>
              </SelectItem>
              <SelectItem value="description-asc">
                Description
                <span className="text-muted-foreground">A-Z</span>
              </SelectItem>
              <SelectItem value="description-desc">
                Description <span className="text-muted-foreground">Z-A</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {filteredExpenses.length === 0 && (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {budget.expenses.length === 0
                ? 'No expenses found for this budget'
                : 'No expenses match your filter'}
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
                    onDelete={
                      budget.isActive
                        ? () =>
                            deleteExpenseMutation.mutate({
                              budgetId: id,
                              expenseId: expense.id,
                            })
                        : undefined
                    }
                  />
                ))}
              </div>
              <div className="flex items-center justify-between py-2 pr-3">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="text-foreground font-semibold">
                  {formatCurrency(totalAmount, 'za')}
                </span>
              </div>
            </>
          )}
        </AllExpenses>
      </Layout>
    </>
  )
}
