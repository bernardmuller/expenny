import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils/cn'

import * as TransactionTableCompound from './TransactionTable.compound'
import type { TransactionTableProps } from '../shared/Transaction.types'

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
        <TransactionTableCompound.Table>
          <TransactionTableCompound.TableHeader>
            <TransactionTableCompound.TableRow className="hover:bg-transparent">
              <TableHead
                className="text-muted-foreground pl-6 text-xs tracking-wide
                  uppercase"
              >
                Date
              </TableHead>
              <TableHead
                className="text-muted-foreground text-xs tracking-wide
                  uppercase"
              >
                Description
              </TableHead>
              <TableHead
                className="text-muted-foreground text-xs tracking-wide
                  uppercase"
              >
                Category
              </TableHead>
              <TableHead
                className="text-muted-foreground text-xs tracking-wide
                  uppercase"
              >
                Confidence
              </TableHead>
              <TableHead
                className="text-muted-foreground text-right text-xs
                  tracking-wide uppercase"
              >
                Amount
              </TableHead>
              <TableHead
                className="text-muted-foreground pr-6 text-right text-xs
                  tracking-wide uppercase"
              >
                Balance
              </TableHead>
            </TransactionTableCompound.TableRow>
          </TransactionTableCompound.TableHeader>
          <TransactionTableCompound.TableBody>
            {transactions.map((transaction) => {
              const isSelected = transaction.id === selectedId

              return (
                <TransactionTableCompound.TableRow
                  key={transaction.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className={cn(
                    'cursor-pointer',
                    isSelected && 'bg-primary/10 hover:bg-primary/10',
                  )}
                  onClick={() => onSelect?.(transaction.id)}
                >
                  <TableCell className="text-muted-foreground pl-6">
                    {transaction.date}
                  </TableCell>
                  <TableCell>
                    <TransactionTableCompound.MerchantCell
                      emoji={transaction.category.icon}
                      description={transaction.description}
                      originalDescription={transaction.originalDescription}
                    />
                  </TableCell>
                  <TableCell>
                    <TransactionTableCompound.CategoryPill
                      icon={transaction.category.icon}
                      label={transaction.category.label}
                    />
                  </TableCell>
                  <TableCell>
                    {typeof transaction.confidence === 'number' && (
                      <TransactionTableCompound.ConfidenceCell
                        value={transaction.confidence}
                      />
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'font-grotesk text-right font-semibold',
                      transaction.direction === 'in' && 'text-primary',
                    )}
                  >
                    {transaction.amount}
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-6 text-right">
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
          <Button variant="link" className="text-primary h-auto p-0" asChild>
            <LinkProvider>View all {totalCount} transactions</LinkProvider>
          </Button>
        )}
      </TransactionTableCompound.Footer>
    </TransactionTableCompound.Root>
  )
}
