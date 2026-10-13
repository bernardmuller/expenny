import type { TransactionListProps } from '../shared/Transaction.types'
import * as TransactionListCompound from './TransactionList.compound'

export function TransactionList({
  transactions,
  filters,
  activeFilter,
  totalCount,
  onFilterChange,
  onSelect,
  linkProvider: LinkProvider,
}: TransactionListProps) {
  return (
    <TransactionListCompound.Root>
      <TransactionListCompound.Header>
        <TransactionListCompound.Title>
          Transactions
        </TransactionListCompound.Title>
        {LinkProvider && (
          <TransactionListCompound.ViewAll asChild>
            <LinkProvider>View all {totalCount}</LinkProvider>
          </TransactionListCompound.ViewAll>
        )}
      </TransactionListCompound.Header>
      <TransactionListCompound.Filters>
        {filters.map((filter) => (
          <TransactionListCompound.Filter
            key={filter.id}
            pressed={filter.id === activeFilter}
            onPressedChange={() => onFilterChange?.(filter.id)}
          >
            {filter.label}
          </TransactionListCompound.Filter>
        ))}
      </TransactionListCompound.Filters>
      <TransactionListCompound.List>
        {transactions.map((transaction) => (
          <TransactionListCompound.Row
            key={transaction.id}
            dimmed={transaction.counted === false}
            onClick={() => onSelect?.(transaction.id)}
          >
            <TransactionListCompound.RowEmoji>
              {transaction.category.icon}
            </TransactionListCompound.RowEmoji>
            <TransactionListCompound.RowContent>
              <TransactionListCompound.RowTitle>
                {transaction.description}
              </TransactionListCompound.RowTitle>
              <TransactionListCompound.RowMeta>
                <span className="text-muted-foreground">
                  {transaction.category.label}
                </span>
                {transaction.needsReview && (
                  <TransactionListCompound.ReviewBadge />
                )}
              </TransactionListCompound.RowMeta>
            </TransactionListCompound.RowContent>
            <TransactionListCompound.RowAmount
              amount={transaction.amount}
              muted={transaction.counted === false}
              meta={
                transaction.counted === false
                  ? `Not counted · ${transaction.date}`
                  : transaction.date
              }
            />
          </TransactionListCompound.Row>
        ))}
      </TransactionListCompound.List>
    </TransactionListCompound.Root>
  )
}
