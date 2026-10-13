import { Button } from '@/components/v2/ui/button'
import { TableCell, TableHead } from '@/components/v2/ui/table'
import { cn } from '@/lib/utils/cn'

import * as TransactionTableCompound from './TransactionTable.compound'
import type { TransactionTableProps } from '../shared/Transaction.types'

const headClassName =
  'text-muted-foreground h-9 px-3 text-xs font-semibold tracking-[0.06em] uppercase'

export function TransactionTable({
  transactions,
  filters,
  activeFilter,
  totalCount,
  search,
  selectedId,
  shownCount,
  onFilterChange,
  onSearchChange,
  onSelect,
  linkProvider: LinkProvider,
}: TransactionTableProps) {
  return (
    <TransactionTableCompound.Root>
      <TransactionTableCompound.Toolbar>
        <TransactionTableCompound.FilterTabs
          filters={filters}
          value={activeFilter}
          onValueChange={onFilterChange}
        />
        <TransactionTableCompound.SearchField
          value={search}
          onChange={onSearchChange}
        />
      </TransactionTableCompound.Toolbar>
      <TransactionTableCompound.Content>
        <TransactionTableCompound.Table
          className="table-fixed border-separate border-spacing-0"
        >
          <TransactionTableCompound.TableHeader>
            <TransactionTableCompound.TableRow
              className="border-transparent hover:bg-transparent"
            >
              <TableHead className={cn(headClassName, 'w-13 pr-0 pl-3')}>
                Date
              </TableHead>
              <TableHead className={headClassName}>Description</TableHead>
              <TableHead className={cn(headClassName, 'w-31')}>
                Category
              </TableHead>
              <TableHead className={cn(headClassName, 'w-24 px-2')}>
                Confidence
              </TableHead>
              <TableHead className={cn(headClassName, 'w-26 text-right')}>
                Amount
              </TableHead>
              <TableHead className={cn(headClassName, 'w-26 px-2 text-right')}>
                Balance
              </TableHead>
            </TransactionTableCompound.TableRow>
          </TransactionTableCompound.TableHeader>
          <TransactionTableCompound.TableBody>
            {transactions.map((transaction) => {
              const isSelected = transaction.id === selectedId
              const isIncome = transaction.direction === 'in'
              const isNotCounted = transaction.counted === false

              return (
                <TransactionTableCompound.TableRow
                  key={transaction.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className={cn(
                    `group hover:bg-raised/50
                    data-[state=selected]:[&>td]:border-chart-5/45
                    data-[state=selected]:[&>td]:bg-chart-5/10
                    data-[state=selected]:hover:[&>td]:bg-chart-5/10 h-16
                    cursor-pointer border-transparent
                    data-[state=selected]:[&>td]:border-y
                    data-[state=selected]:[&>td]:[box-shadow:inset_0_3px_0_rgba(0,0,0,0.25)]
                    [&>td:first-child]:rounded-l-2xl
                    data-[state=selected]:[&>td:first-child]:border-l
                    [&>td:last-child]:rounded-r-2xl
                    data-[state=selected]:[&>td:last-child]:border-r`,
                  )}
                  onClick={() => onSelect?.(transaction.id)}
                >
                  <TableCell className="text-muted-foreground pr-0 pl-3 text-sm">
                    {transaction.date}
                  </TableCell>
                  <TableCell className="pr-3 pl-0">
                    <TransactionTableCompound.MerchantCell
                      emoji={transaction.category.icon}
                      description={transaction.description}
                      originalDescription={transaction.originalDescription}
                      category={transaction.category.label}
                    />
                  </TableCell>
                  <TableCell className="px-3">
                    <TransactionTableCompound.CategoryPill
                      label={transaction.category.label}
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    {typeof transaction.confidence === 'number' && (
                      <TransactionTableCompound.ConfidenceCell
                        value={transaction.confidence}
                      />
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'font-display px-2 text-right text-base font-semibold',
                      isIncome && 'text-primary',
                      isNotCounted && 'text-muted-foreground',
                    )}
                  >
                    {transaction.amount}
                    {isNotCounted && (
                      <span
                        className="text-muted-foreground block text-[11.5px]
                          font-normal"
                      >
                        Not counted
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground px-3 pr-3 text-right
                      text-sm"
                  >
                    {transaction.balance ?? '—'}
                  </TableCell>
                </TransactionTableCompound.TableRow>
              )
            })}
          </TransactionTableCompound.TableBody>
        </TransactionTableCompound.Table>
      </TransactionTableCompound.Content>
      <TransactionTableCompound.Footer>
        <span className="text-muted-foreground text-sm">
          Showing {shownCount ?? transactions.length} of {totalCount}
        </span>
        {LinkProvider && (
          <Button
            variant="link"
            className="text-primary h-11 p-0 text-[15px]"
            asChild
          >
            <LinkProvider>View all {totalCount} transactions</LinkProvider>
          </Button>
        )}
      </TransactionTableCompound.Footer>
    </TransactionTableCompound.Root>
  )
}
