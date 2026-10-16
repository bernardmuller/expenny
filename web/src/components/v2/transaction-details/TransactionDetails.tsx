import { filterCategoryOptionsByDirection } from '../shared/categories'
import { CategoryPicker } from '../shared/CategoryPicker'
import * as TransactionDetailsCompound from './TransactionDetails.compound'
import type { TransactionDetailsProps } from './TransactionDetails.types'

/**
 * Read-only details for a statement row that is already classified. Rendered
 * in the dashboard's right column when the highlighted table row is not
 * waiting on a human, so the space next to an empty review queue still shows
 * something useful.
 */
export function TransactionDetails({
  item,
  categoryOptions,
  onCategoryChange,
  className,
}: TransactionDetailsProps) {
  const options = categoryOptions
    ? filterCategoryOptionsByDirection(categoryOptions, item.isIncome)
    : null

  return (
    <TransactionDetailsCompound.Root className={className}>
      <TransactionDetailsCompound.Header>
        <TransactionDetailsCompound.Title>
          Transaction details
        </TransactionDetailsCompound.Title>
      </TransactionDetailsCompound.Header>
      <TransactionDetailsCompound.Merchant
        emoji={item.emoji}
        name={item.merchant}
        date={item.date}
        amount={item.amount}
        category={item.category.label}
        size="md"
      />
      <TransactionDetailsCompound.Statement
        date={item.date}
        amount={item.amount}
        merchant={item.merchant}
        category={item.category.label}
      >
        {item.originalDescription}
      </TransactionDetailsCompound.Statement>
      <TransactionDetailsCompound.Classification inline label="Categorised as">
        {options && onCategoryChange ? (
          <CategoryPicker
            trigger={
              <TransactionDetailsCompound.CategoryPill
                icon={item.category.icon}
                label={item.category.label}
              />
            }
            label={item.merchant}
            value={item.category.id}
            groupKey={item.group}
            options={options}
            onChange={onCategoryChange}
            align="end"
          />
        ) : (
          <TransactionDetailsCompound.CategoryPill
            icon={item.category.icon}
            label={item.category.label}
          />
        )}
      </TransactionDetailsCompound.Classification>
      <TransactionDetailsCompound.Classification inline label="Confidence">
        <TransactionDetailsCompound.Confidence value={item.confidence} />
      </TransactionDetailsCompound.Classification>
      <TransactionDetailsCompound.Footer>
        <span className="text-muted-foreground text-[13px]">
          Balance after: {item.balanceAfter}
        </span>
      </TransactionDetailsCompound.Footer>
    </TransactionDetailsCompound.Root>
  )
}
