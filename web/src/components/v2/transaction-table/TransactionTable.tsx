import { ArrowLeftRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { UIEventHandler } from 'react'

import { Button } from '@/components/v2/ui/button'
import { Spinner } from '@/components/v2/ui/spinner'
import { TableCell, TableHead } from '@/components/v2/ui/table'
import { cn } from '@/lib/utils/cn'

import { filterCategoryOptionsByDirection } from '../shared/categories'
import { PanelHeader } from '../shared/PanelHeader'
import * as TransactionTableCompound from './TransactionTable.compound'
import type { TransactionTableProps } from '../shared/Transaction.types'

const headClassName =
  'text-muted-foreground h-9 px-3 text-xs font-semibold tracking-[0.06em] uppercase'

/** Distance from the bottom, in pixels, that triggers the next page. */
const LOAD_MORE_THRESHOLD = 240

export function TransactionTable({
  transactions,
  filters,
  activeFilter,
  totalCount,
  search,
  selectedId,
  shownCount,
  className,
  categoryOptions,
  onCategoryChange,
  onFilterChange,
  onSearchChange,
  onSelect,
  hasMore,
  isLoadingMore,
  onLoadMore,
  linkProvider: LinkProvider,
}: TransactionTableProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const handleScroll: UIEventHandler<HTMLDivElement> = (event) => {
    if (!hasMore || isLoadingMore || !onLoadMore) return
    const element = event.currentTarget
    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight
    if (distanceToBottom <= LOAD_MORE_THRESHOLD) onLoadMore()
  }

  // A short first page on a tall screen never scrolls, so top it up until the
  // table overflows or there is nothing left to fetch.
  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return
    const element = contentRef.current
    if (element && element.scrollHeight <= element.clientHeight) onLoadMore()
  }, [hasMore, isLoadingMore, onLoadMore, transactions.length])

  return (
    <TransactionTableCompound.Root className={cn('h-full min-h-0', className)}>
      <PanelHeader
        icon={<ArrowLeftRight className="size-4.5 text-[#5bb5ff]" />}
        title="Transactions"
        description="Every classified statement row. Select one to see its details."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TransactionTableCompound.SearchField
              value={search}
              onChange={onSearchChange}
            />
            <TransactionTableCompound.FilterMenu
              filters={filters}
              value={activeFilter}
              onValueChange={onFilterChange}
            />
          </div>
        }
        className="pb-4"
      />
      <TransactionTableCompound.Content
        ref={contentRef}
        className="min-h-0 flex-1 overflow-auto
          [&>[data-slot=table-container]]:overflow-visible"
        onScroll={handleScroll}
      >
        <TransactionTableCompound.Table
          className="table-fixed border-separate border-spacing-0"
        >
          <TransactionTableCompound.TableHeader>
            <TransactionTableCompound.TableRow
              className="bg-card hover:bg-card sticky top-0 z-10
                border-transparent"
            >
              <TableHead className={cn(headClassName, 'w-18 pr-0 pl-3')}>
                Date
              </TableHead>
              <TableHead className={headClassName}>Description</TableHead>
              <TableHead className={cn(headClassName, 'w-40')}>
                Category
              </TableHead>
              <TableHead className={cn(headClassName, 'w-32 px-2')}>
                Confidence
              </TableHead>
              <TableHead className={cn(headClassName, 'w-32 text-right')}>
                Amount
              </TableHead>
              <TableHead className={cn(headClassName, 'w-30 px-2 text-right')}>
                Balance
              </TableHead>
            </TransactionTableCompound.TableRow>
          </TransactionTableCompound.TableHeader>
          <TransactionTableCompound.TableBody>
            {transactions.map((transaction) => {
              const isSelected = transaction.id === selectedId
              const isIncome = transaction.direction === 'in'

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
                  <TableCell
                    className="text-muted-foreground pr-0 pl-3 text-sm
                      whitespace-nowrap"
                  >
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
                    {onCategoryChange && categoryOptions ? (
                      <TransactionTableCompound.CategoryPicker
                        label={transaction.category.label}
                        value={transaction.category.id}
                        groupKey={transaction.category.group}
                        options={filterCategoryOptionsByDirection(
                          categoryOptions,
                          transaction.direction === 'in',
                        )}
                        onChange={(categoryId, groupKey) =>
                          onCategoryChange(transaction.id, categoryId, groupKey)
                        }
                      />
                    ) : (
                      <TransactionTableCompound.CategoryPill
                        label={transaction.category.label}
                      />
                    )}
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
                      `font-display px-2 text-right text-base font-semibold
                      whitespace-nowrap tabular-nums`,
                      isIncome && 'text-primary',
                    )}
                  >
                    {transaction.amount}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground px-3 text-right text-sm
                      whitespace-nowrap tabular-nums"
                  >
                    {transaction.balance ?? '—'}
                  </TableCell>
                </TransactionTableCompound.TableRow>
              )
            })}
            {isLoadingMore && (
              <TransactionTableCompound.TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-14 text-center text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="size-4" />
                    Loading more transactions…
                  </span>
                </TableCell>
              </TransactionTableCompound.TableRow>
            )}
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
