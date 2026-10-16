import { AddExpenseFormSkeleton } from '@/components/add-expense-form/AddExpenseForm.skeleton'
import { CurrentBudgetSkeleton } from '@/components/current-budget/CurrentBudget.skeleton'
import { Layout } from '@/components/layouts/Layout'
import { RecentExpensesSkeleton } from '@/components/recent-expenses/RecentExpenses.skeleton'

export function DashboardSkeleton() {
  return (
    <Layout>
      <CurrentBudgetSkeleton />
      <AddExpenseFormSkeleton />
      <RecentExpensesSkeleton />
    </Layout>
  )
}
