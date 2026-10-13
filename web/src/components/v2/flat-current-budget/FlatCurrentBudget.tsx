import * as FlatCurrentBudgetCompound from './FlatCurrentBudget.compound'
import type { FlatCurrentBudgetProps } from './FlatCurrentBudget.types'

export function FlatCurrentBudget({
  budgetName,
  currentAmount,
  startingAmount,
  spentAmount,
  spentPercentage,
  daysLeft,
  linkProvider: LinkProvider,
}: FlatCurrentBudgetProps) {
  return (
    <FlatCurrentBudgetCompound.Root>
      <FlatCurrentBudgetCompound.Info>
        <FlatCurrentBudgetCompound.Title>
          {LinkProvider ? (
            <LinkProvider>
              <span className="flex items-center gap-1 hover:underline">
                Current Budget
                <FlatCurrentBudgetCompound.Chevron />
              </span>
            </LinkProvider>
          ) : (
            <span className="flex items-center gap-1">
              Current Budget
              <FlatCurrentBudgetCompound.Chevron />
            </span>
          )}
        </FlatCurrentBudgetCompound.Title>
        <FlatCurrentBudgetCompound.Period>
          {budgetName}
        </FlatCurrentBudgetCompound.Period>
      </FlatCurrentBudgetCompound.Info>
      <FlatCurrentBudgetCompound.Remaining
        amount={currentAmount}
        of={startingAmount}
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
