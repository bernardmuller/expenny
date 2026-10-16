import * as FlatCurrentBudgetCompound from './FlatCurrentBudget.compound'
import type { FlatCurrentBudgetProps } from './FlatCurrentBudget.types'

export function FlatCurrentBudget({
  budgetName,
  budgetMonth,
  currentAmount,
  startingAmount,
  spentAmount,
  spentPercentage,
  daysLeft,
  onEdit,
  onClick,
  linkProvider: LinkProvider,
}: FlatCurrentBudgetProps) {
  return (
    <FlatCurrentBudgetCompound.Root>
      <FlatCurrentBudgetCompound.Info>
        <FlatCurrentBudgetCompound.Title>
          {LinkProvider ? (
            <LinkProvider>
              <span className="flex items-center gap-1 hover:underline">
                {budgetMonth ?? 'Current Budget'}
                <FlatCurrentBudgetCompound.Chevron />
              </span>
            </LinkProvider>
          ) : (
            <span className="flex items-center gap-1">
              {budgetMonth ?? 'Current Budget'}
              <FlatCurrentBudgetCompound.Chevron />
            </span>
          )}
        </FlatCurrentBudgetCompound.Title>
        <FlatCurrentBudgetCompound.Period onEdit={onEdit}>
          {budgetName}
        </FlatCurrentBudgetCompound.Period>
      </FlatCurrentBudgetCompound.Info>
      <FlatCurrentBudgetCompound.Remaining
        amount={currentAmount}
        of={startingAmount}
        onClick={onClick}
      />
      <FlatCurrentBudgetCompound.Spent
        amount={spentAmount}
        percentage={spentPercentage}
      />
      {typeof daysLeft === 'number' && (
        <FlatCurrentBudgetCompound.DaysLeftBadge daysLeft={daysLeft} />
      )}
    </FlatCurrentBudgetCompound.Root>
  )
}
