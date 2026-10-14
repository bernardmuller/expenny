import { Link } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  CheckCircle2,
  FileText,
  Home,
  LayoutDashboard,
  Settings2,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { AppSidebar } from '@/components/v2/app-sidebar/AppSidebar'
import type { SidebarNavItem } from '@/components/v2/app-sidebar/AppSidebar.types'
import { CurrentBudget } from '@/components/v2/current-budget/CurrentBudget'
import { FlatCurrentBudget } from '@/components/v2/flat-current-budget/FlatCurrentBudget'
import { MobileNav } from '@/components/v2/mobile-nav/MobileNav'
import type { MobileNavItem } from '@/components/v2/mobile-nav/MobileNav.types'
import { TransactionList } from '@/components/v2/transaction-list/TransactionList'
import { TransactionTable } from '@/components/v2/transaction-table/TransactionTable'
import { Button } from '@/components/v2/ui/button'
import { Card, CardContent } from '@/components/v2/ui/card'
import { UploadDrawer } from '@/components/v2/upload-drawer/UploadDrawer'
import { useIsMobile } from '@/hooks/use-mobile'

import { ReviewFlow } from './-review-flow'
import { useDashboard } from './-use-dashboard'
import type { DashboardModel } from './-use-dashboard'

const DashboardLink = ({ children }: { children: ReactNode }) => (
  <Link to="/v2/dashboard">{children}</Link>
)

function desktopNavItems(reviewCount: number): Array<SidebarNavItem> {
  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      accent: '#4cc38a',
      linkProvider: DashboardLink,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: ArrowLeftRight,
      accent: '#5bb5ff',
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    { id: 'budgets', label: 'Budgets', icon: Wallet, accent: '#f472b6' },
    {
      id: 'statements',
      label: 'Statements',
      icon: FileText,
      accent: '#a78bfa',
    },
    { id: 'settings', label: 'Settings', icon: Settings2, accent: '#bdbdbd' },
  ]
}

function mobileNavItems(reviewCount: number): Array<MobileNavItem> {
  return [
    { id: 'dashboard', label: 'Home', icon: Home, accent: '#4cc38a' },
    {
      id: 'transactions',
      label: 'Activity',
      icon: ArrowLeftRight,
      accent: '#5bb5ff',
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    { id: 'budgets', label: 'Budgets', icon: Wallet, accent: '#f472b6' },
    { id: 'statements', label: 'Files', icon: FileText, accent: '#a78bfa' },
  ]
}

export function Dashboard() {
  const model = useDashboard()
  const isMobile = useIsMobile()

  return (
    <>
      {isMobile ? (
        <MobileDashboard model={model} />
      ) : (
        <DesktopDashboard model={model} />
      )}

      <input
        ref={model.upload.inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={model.upload.onFileChange}
      />

      <UploadDrawer
        open={model.upload.open}
        onOpenChange={(open) => {
          if (!open) model.upload.close()
        }}
        fileName={model.upload.fileName}
        fileRange={model.upload.fileRange}
        steps={model.upload.steps}
        sorted={model.upload.sorted}
        onCancel={model.upload.close}
      />
    </>
  )
}

function DesktopDashboard({ model }: { model: DashboardModel }) {
  return (
    <div
      className="bg-background font-body text-foreground flex h-svh
        overflow-hidden"
    >
      <AppSidebar
        items={desktopNavItems(model.reviewCount)}
        activeId="dashboard"
        userName={model.user.name}
        onNavigate={() => {}}
        onUpload={model.upload.openPicker}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-8 pt-8 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1
                className="font-display text-[34px] leading-[1.1] font-semibold"
              >
                Hi, {model.user.name}!
              </h1>
              <p className="text-muted-foreground mt-1 text-[15px]">
                Here's where {model.monthLabel} stands.
              </p>
            </div>
            <div
              className="bg-card border-border text-card-foreground flex h-11
                items-center gap-2.5 rounded-full border px-4 text-sm
                [box-shadow:0_3px_0_var(--lip)]"
            >
              <FileText className="size-4 text-[#a78bfa]" />
              {model.statementSummary}
            </div>
          </div>

          <FlatCurrentBudget
            budgetName={model.budget.budgetName}
            currentAmount={model.budget.currentAmount}
            startingAmount={model.budget.startingAmount}
            spentAmount={model.budget.spentAmount}
            spentPercentage={model.budget.spentPercentage}
            daysLeft={model.budget.daysLeft}
          />

          <div
            className="grid min-h-0 flex-1 items-stretch gap-5
              md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
          >
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
            />
            <div className="min-h-0 overflow-y-auto pr-1">
              {model.currentReview ? (
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
                  onImport={model.upload.openPicker}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function MobileDashboard({ model }: { model: DashboardModel }) {
  return (
    <div className="bg-background font-body text-foreground min-h-svh">
      <div
        className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-4 pb-32"
      >
        <MobileNav
          userName={model.user.name}
          items={mobileNavItems(model.reviewCount)}
          activeId="dashboard"
          onNavigate={() => {}}
          onUpload={model.upload.openPicker}
        />
        <CurrentBudget
          budgetName={model.budget.budgetName}
          currentAmount={model.budget.currentAmount}
          startingAmount={model.budget.startingAmount}
          spentAmount={model.budget.spentAmount}
          spentPercentage={model.budget.spentPercentage}
          daysLeft={model.budget.daysLeft}
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
            onImport={model.upload.openPicker}
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
