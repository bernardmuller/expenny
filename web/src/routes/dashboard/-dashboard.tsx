import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, LogOut, Upload } from 'lucide-react'

import { BudgetPeriodDialog } from '@/components/v2/budget-period-dialog/BudgetPeriodDialog'
import { CategoryAdmin } from '@/components/v2/category-admin/CategoryAdmin'
import { CategoryBudgetTable } from '@/components/v2/category-budget-table/CategoryBudgetTable'
import { CorrectionsAdmin } from '@/components/v2/corrections-admin/CorrectionsAdmin'
import { CurrentBudget } from '@/components/v2/current-budget/CurrentBudget'
import { DashboardGreeting } from '@/components/v2/dashboard-greeting/DashboardGreeting'
import { FlatCurrentBudget } from '@/components/v2/flat-current-budget/FlatCurrentBudget'
import { TransactionDetails } from '@/components/v2/transaction-details/TransactionDetails'
import { TransactionList } from '@/components/v2/transaction-list/TransactionList'
import { TransactionTable } from '@/components/v2/transaction-table/TransactionTable'
import { Button } from '@/components/v2/ui/button'
import { Card, CardContent } from '@/components/v2/ui/card'
import { Spinner } from '@/components/v2/ui/spinner'
import { Table, TableBody, TableCell, TableRow } from '@/components/v2/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/v2/ui/tabs'
import { ThemeToggle } from '@/components/v2/ui/theme-toggle'
import { UploadDrawer } from '@/components/v2/upload-drawer/UploadDrawer'
import { CategoryColorsProvider } from '@/components/v2/shared/CategoryColors'
import { getCategoryTransactionsQueryOptions } from '@/lib/http/v2/queries/category-budgets'
import type { StatementTransaction } from '@/lib/http/v2/types'
import { useAuth } from '@/lib/auth/auth-provider'
import { cn } from '@/lib/utils/cn'
import { useIsMobile } from '@/hooks/use-mobile'

import { ReviewFlow } from './-review-flow'
import { toStatementTransaction } from './-mappers'
import { useDashboard } from './-use-dashboard'
import type { DashboardModel } from './-use-dashboard'

export function Dashboard() {
  const model = useDashboard()
  const isMobile = useIsMobile()

  return (
    <CategoryColorsProvider labels={model.categoryLabels}>
      {isMobile ? (
        <MobileDashboard model={model} />
      ) : (
        <DesktopDashboard model={model} />
      )}

      <BudgetPeriodDialog {...model.budgetDialog} />

      <UploadDrawer
        open={model.upload.open}
        onOpenChange={(open) => {
          if (!open) model.upload.close()
        }}
        status={model.upload.status}
        fileName={model.upload.fileName}
        fileRange={model.upload.fileRange}
        csvText={model.upload.csvText}
        onCsvTextChange={model.upload.onCsvTextChange}
        onPasteSubmit={model.upload.onPasteSubmit}
        onFile={model.upload.onFile}
        steps={model.upload.steps}
        sorted={model.upload.sorted}
        summary={model.upload.summary}
        onCancel={model.upload.onCancel}
        onDone={model.upload.close}
      />
    </CategoryColorsProvider>
  )
}

function DashboardHeader({ model }: { model: DashboardModel }) {
  const { logout } = useAuth()

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <DashboardGreeting userName={model.user.name} />
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <Button
          className="h-12 gap-2.5 rounded-full px-5"
          onClick={model.upload.openDrawer}
        >
          <Upload className="size-4.5" />
          Import statement
        </Button>
        <ThemeToggle />
        <Button
          variant="outline"
          size="icon"
          aria-label="Sign out"
          title="Sign out"
          className="size-12 shrink-0 rounded-full"
          onClick={() => void logout()}
        >
          <LogOut className="size-4.5" />
        </Button>
      </div>
    </header>
  )
}

function DesktopDashboard({ model }: { model: DashboardModel }) {
  const selected = model.selectedTransaction

  return (
    <div
      className="bg-background font-body text-foreground flex h-svh flex-col
        overflow-hidden"
    >
      <div
        className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col
          gap-6 px-8 pt-8 pb-6"
      >
        <DashboardHeader model={model} />

        <FlatCurrentBudget
          budgetName={model.budget.budgetName}
          budgetMonth={model.budget.budgetMonth}
          currentAmount={model.budget.currentAmount}
          startingAmount={model.budget.startingAmount}
          spentAmount={model.budget.spentAmount}
          spentPercentage={model.budget.spentPercentage}
          daysLeft={model.budget.daysLeft}
          onEdit={model.budget.onEdit}
          onClick={model.budget.onTogglePrivacy}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <DashboardViewTabs
            value={model.dashboardView}
            onChange={model.onDashboardViewChange}
          />
          {model.dashboardView === 'categories' ? (
            <CategoryAdmin className={MAIN_GRID} />
          ) : model.dashboardView === 'corrections' ? (
            <CorrectionsAdmin className="min-h-0 flex-1" />
          ) : (
            <div className={MAIN_GRID}>
              <div className="flex min-h-0 flex-1 flex-col">
                {model.dashboardView === 'transactions' && (
                  <TransactionTable
                    transactions={model.filteredTransactions}
                    filters={model.filters}
                    activeFilter={model.activeFilter}
                    totalCount={model.totalCount}
                    shownCount={model.filteredTransactions.length}
                    search={model.search}
                    selectedId={model.selectedId ?? undefined}
                    categoryOptions={model.categoryOptions}
                    onCategoryChange={model.onCategoryChange}
                    onFilterChange={model.onFilterChange}
                    onSearchChange={model.onSearchChange}
                    onSelect={model.onSelect}
                    hasMore={model.hasMoreTransactions}
                    isLoadingMore={model.isLoadingMoreTransactions}
                    onLoadMore={model.onLoadMoreTransactions}
                  />
                )}
                {model.dashboardView === 'budget' &&
                  (model.categoryBudgets.overview ? (
                    <CategoryBudgetTable
                      groups={model.categoryBudgets.overview.groups}
                      isSavingBudget={model.categoryBudgets.isSaving}
                      onSetBudget={model.categoryBudgets.onSetBudget}
                      onDeleteBudget={model.categoryBudgets.onDeleteBudget}
                      renderExpanded={(categoryId) => (
                        <CategoryTransactions
                          categoryId={categoryId}
                          selectedId={model.selectedId ?? undefined}
                          onSelect={model.onSelectTransactionFromCategory}
                        />
                      )}
                    />
                  ) : (
                    <Card
                      className="border-border flex min-h-40 flex-1 items-center
                        justify-center"
                    >
                      {model.categoryBudgets.isLoading ? (
                        <span
                          className="text-muted-foreground inline-flex
                            items-center gap-2 text-sm"
                        >
                          <Spinner className="size-4" />
                          Loading budgets…
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          No active budget. Category allocations need one.
                        </span>
                      )}
                    </Card>
                  ))}
              </div>
              <div className="min-h-0 overflow-y-auto pr-1">
                {model.showSelectedDetails && selected ? (
                  <TransactionDetails
                    item={selected}
                    categoryOptions={model.categoryOptions}
                    onCategoryChange={(categoryId, groupKey) =>
                      model.onCategoryChange(selected.id, categoryId, groupKey)
                    }
                  />
                ) : model.currentReview ? (
                  <ReviewFlow
                    key={model.currentReview.id}
                    item={model.currentReview}
                    index={model.currentReviewIndex}
                    total={model.reviewTotal}
                    isMobile={false}
                    categoryOptions={model.categoryOptions}
                    onConfirm={model.confirmReview}
                    onSkip={model.skipReview}
                    onPrev={model.onPrevReview}
                    onNext={model.onNextReview}
                  />
                ) : (
                  <ReviewEmptyState
                    hasTransactions={model.totalCount > 0}
                    onImport={model.upload.openDrawer}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MobileDashboard({ model }: { model: DashboardModel }) {
  return (
    <div className="bg-background font-body text-foreground min-h-svh">
      <div
        className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-4 pb-10"
      >
        <DashboardHeader model={model} />
        <CurrentBudget
          budgetName={model.budget.budgetName}
          budgetMonth={model.budget.budgetMonth}
          currentAmount={model.budget.currentAmount}
          startingAmount={model.budget.startingAmount}
          spentAmount={model.budget.spentAmount}
          spentPercentage={model.budget.spentPercentage}
          daysLeft={model.budget.daysLeft}
          onEdit={model.budget.onEdit}
          onClick={model.budget.onTogglePrivacy}
        />
        {model.currentReview ? (
          <ReviewFlow
            key={model.currentReview.id}
            item={model.currentReview}
            index={model.currentReviewIndex}
            total={model.reviewTotal}
            isMobile
            categoryOptions={model.categoryOptions}
            onConfirm={model.confirmReview}
            onSkip={model.skipReview}
            onPrev={model.onPrevReview}
            onNext={model.onNextReview}
          />
        ) : (
          <ReviewEmptyState
            hasTransactions={model.totalCount > 0}
            onImport={model.upload.openDrawer}
          />
        )}
        <TransactionList
          transactions={model.filteredTransactions.slice(0, 7)}
          filters={model.filters}
          activeFilter={model.activeFilter}
          totalCount={model.totalCount}
          onFilterChange={model.onFilterChange}
          onSelect={model.onSelect}
        />
      </div>
    </div>
  )
}

const MAIN_GRID =
  'grid min-h-0 flex-1 items-stretch gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'

const DASHBOARD_TABS = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'budget', label: 'Budget' },
  { value: 'categories', label: 'Categories' },
  { value: 'corrections', label: 'Corrections' },
] as const

function DashboardViewTabs({
  value,
  onChange,
}: {
  value: 'transactions' | 'budget' | 'categories' | 'corrections'
  onChange: (
    value: 'transactions' | 'budget' | 'categories' | 'corrections',
  ) => void
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) =>
        onChange(
          next as 'transactions' | 'budget' | 'categories' | 'corrections',
        )
      }
      className="z-10 -mb-px w-full shrink-0 px-6"
    >
      <TabsList className="h-auto items-end gap-1.5 bg-transparent p-0">
        {DASHBOARD_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              `bg-muted text-muted-foreground hover:text-foreground
              focus-visible:ring-primary/40 border-border
              data-[state=active]:bg-card data-[state=active]:text-foreground
              relative h-10 rounded-t-2xl rounded-b-none border border-b-0 px-5
              text-sm font-medium transition-colors outline-none
              focus-visible:ring-[3px] data-[state=active]:z-10
              data-[state=active]:font-semibold`,
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function CategoryTransactions({
  categoryId,
  selectedId,
  onSelect,
}: {
  categoryId: string
  selectedId?: string
  onSelect: (transaction: StatementTransaction) => void
}) {
  const query = useQuery(getCategoryTransactionsQueryOptions(categoryId))

  if (query.isLoading) {
    return (
      <div
        className="text-muted-foreground flex items-center gap-2 px-6 py-4
          text-sm"
      >
        <Spinner className="size-4" />
        Loading transactions…
      </div>
    )
  }

  const transactions = query.data?.transactions ?? []
  if (transactions.length === 0) {
    return (
      <p className="text-muted-foreground px-6 py-4 text-sm">
        No transactions in this category for the budget window.
      </p>
    )
  }

  return (
    <Table>
      <TableBody>
        {transactions.map((transaction) => {
          const display = toStatementTransaction(transaction)
          return (
            <TableRow
              key={transaction.id}
              data-state={
                transaction.id === selectedId ? 'selected' : undefined
              }
              className="h-12 cursor-pointer"
              onClick={() => onSelect(transaction)}
            >
              <TableCell
                className="text-muted-foreground w-20 px-6 text-xs
                  whitespace-nowrap"
              >
                {display.date}
              </TableCell>
              <TableCell className="px-3">
                <p className="truncate text-sm font-medium">
                  {display.description}
                </p>
                {display.originalDescription && (
                  <p
                    className="text-muted-foreground font-statement truncate
                      text-xs"
                  >
                    {display.originalDescription}
                  </p>
                )}
              </TableCell>
              <TableCell
                className="px-6 text-right text-sm font-semibold
                  whitespace-nowrap tabular-nums"
              >
                {display.amount}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function ReviewEmptyState({
  hasTransactions,
  onImport,
}: {
  hasTransactions: boolean
  onImport: () => void
}) {
  if (!hasTransactions) {
    return <ImportPrompt onImport={onImport} />
  }

  return <AllCaughtUp />
}

function ImportPrompt({ onImport }: { onImport: () => void }) {
  return (
    <Card variant="highlight" className="gap-3 p-8">
      <CardContent className="flex flex-col items-center gap-3 px-0 text-center">
        <FileText className="text-muted-foreground size-8" />
        <p className="font-display text-lg font-semibold">No statement yet</p>
        <p className="text-muted-foreground text-sm">
          Import a CSV to start categorising your spending.
        </p>
        <Button onClick={onImport}>Import statement</Button>
      </CardContent>
    </Card>
  )
}

function AllCaughtUp() {
  return (
    <Card variant="highlight" className="gap-3 p-8">
      <CardContent className="flex flex-col items-center gap-2 px-0 text-center">
        <CheckCircle2 className="text-primary size-8" />
        <p className="font-display text-lg font-semibold">
          You're all caught up
        </p>
        <p className="text-muted-foreground text-sm">
          Nothing needs your attention right now.
        </p>
      </CardContent>
    </Card>
  )
}
