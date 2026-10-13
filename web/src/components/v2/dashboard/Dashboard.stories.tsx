import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ArrowLeftRight,
  FileText,
  LayoutDashboard,
  Settings2,
  Upload,
  User,
  Wallet,
} from 'lucide-react'

import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { Button } from '@/components/ui/button'

import { AppSidebar } from '../app-sidebar/AppSidebar'
import type { SidebarNavItem } from '../app-sidebar/AppSidebar.types'
import { CurrentBudget } from '../current-budget/CurrentBudget'
import { FlatCurrentBudget } from '../flat-current-budget/FlatCurrentBudget'
import { ReviewCard } from '../classification-review/ReviewCard'
import { ReviewPanel } from '../classification-review/ReviewPanel'
import { TransactionList } from '../transaction-list/TransactionList'
import { TransactionTable } from '../transaction-table/TransactionTable'
import { UploadDrawer } from '../upload-drawer/UploadDrawer'
import {
  mockCategoryOptions,
  mockReviewItems,
} from '../shared/__mocks__/review.mock'
import {
  mockSortedTransactions,
  mockUploadSteps,
} from '../shared/__mocks__/upload.mock'
import {
  mockTransactionFilters,
  mockTransactions,
} from '../shared/__mocks__/transaction.mock'
import type { StatementTransaction } from '../shared/Transaction.types'

const navItems: Array<SidebarNavItem> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
  { id: 'statements', label: 'Statements', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

const MASK = '✱✱✱✱✱✱✱✱'

function filterTransactions(
  transactions: Array<StatementTransaction>,
  activeFilter: string,
  search: string,
) {
  const byFilter = transactions.filter((transaction) => {
    switch (activeFilter) {
      case 'review':
        return transaction.needsReview
      case 'money-in':
        return transaction.direction === 'in'
      case 'not-counted':
        return transaction.counted === false
      default:
        return true
    }
  })

  if (!search) return byFilter

  return byFilter.filter((transaction) =>
    transaction.description.toLowerCase().includes(search.toLowerCase()),
  )
}

function DesktopDashboard() {
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('transaction-4')
  const [displayName, setDisplayName] = useState('Takealot')
  const [categoryId, setCategoryId] = useState('shopping')
  const [countsTowardBudget, setCountsTowardBudget] = useState(true)

  const transactions = useMemo(
    () => filterTransactions(mockTransactions, activeFilter, search),
    [activeFilter, search],
  )

  return (
    <div className="bg-background flex min-h-svh">
      <AppSidebar
        items={navItems}
        activeId="dashboard"
        userName="Bernard"
        onNavigate={() => {}}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto space-y-6 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-grotesk text-3xl font-semibold">
                Hi, Bernard!
              </h1>
              <p className="text-muted-foreground text-sm">
                Here's where October stands.
              </p>
            </div>
            <Button>
              <Upload />
              Upload statement
            </Button>
          </div>

          <FlatCurrentBudget
            budgetName="October 2026"
            currentAmount="R 4 632"
            startingAmount="R 24 000"
            spentAmount="R 19 368"
            spentPercentage={80.7}
            daysLeft={11}
            linkProvider={({ children }) => <a href="/">{children}</a>}
          />

          <div
            className="grid items-start gap-6
              lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
          >
            <TransactionTable
              transactions={transactions}
              filters={mockTransactionFilters}
              activeFilter={activeFilter}
              totalCount={48}
              shownCount={transactions.length}
              search={search}
              selectedId={selectedId}
              onFilterChange={setActiveFilter}
              onSearchChange={setSearch}
              onSelect={setSelectedId}
              linkProvider={({ children }) => <a href="/">{children}</a>}
            />
            <ReviewPanel
              item={mockReviewItems[1]}
              index={1}
              total={3}
              displayName={displayName}
              categoryId={categoryId}
              categoryOptions={mockCategoryOptions}
              countsTowardBudget={countsTowardBudget}
              onDisplayNameChange={setDisplayName}
              onCategoryChange={setCategoryId}
              onCountsTowardBudgetChange={setCountsTowardBudget}
              onConfirm={() => {}}
              onSkip={() => {}}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

function MobileDashboard({ masked = false }: { masked?: boolean }) {
  const [activeFilter, setActiveFilter] = useState('all')

  const transactions = useMemo(
    () => filterTransactions(mockTransactions, activeFilter, '').slice(0, 7),
    [activeFilter],
  )

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Icon src="/favicon.ico" alt="Expenny icon" />
          <AppHeader.Info appName="Expenny" message="Hi, Bernard!" />
        </AppHeader.Left>
        <div />
        <AppHeader.Right>
          <Button size="sm" className="rounded-2xl">
            <Upload />
            Upload
          </Button>
          <Button variant="ghost" size="icon" aria-label="Profile">
            <User />
          </Button>
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        <CurrentBudget
          budgetName="October 2026"
          currentAmount={masked ? MASK : 'R 4 632'}
          startingAmount={masked ? MASK : 'R 24 000'}
          spentAmount={masked ? MASK : 'R 19 368'}
          spentPercentage={80.7}
          daysLeft={11}
          linkProvider={({ children }) => <a href="/">{children}</a>}
        />
        <ReviewCard
          item={mockReviewItems[0]}
          index={0}
          total={3}
          onLooksRight={() => {}}
          onChange={() => {}}
        />
        <TransactionList
          transactions={transactions}
          filters={mockTransactionFilters}
          activeFilter={activeFilter}
          totalCount={48}
          onFilterChange={setActiveFilter}
          linkProvider={({ children }) => <a href="/">{children}</a>}
        />
      </Layout>
    </>
  )
}

function MobileImportingLayout() {
  const [open, setOpen] = useState(true)

  return (
    <>
      <MobileDashboard masked />
      <UploadDrawer
        open={open}
        onOpenChange={setOpen}
        fileName="capitec_oct_2026.csv"
        fileRange="1 to 12 Oct 2026"
        steps={mockUploadSteps}
        sorted={mockSortedTransactions}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

const meta = {
  title: 'v2/Dashboard',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark">
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  globals: {
    // viewport: { value: 'desktop' },
  },
  render: () => <DesktopDashboard />,
}

export const Mobile: Story = {
  render: () => <MobileDashboard />,
}

export const MobilePrivacy: Story = {
  render: () => <MobileDashboard masked />,
}

export const MobileImporting: Story = {
  render: () => <MobileImportingLayout />,
}
