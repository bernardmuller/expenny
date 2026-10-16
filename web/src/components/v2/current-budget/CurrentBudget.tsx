import type { CurrentBudgetProps } from './CurrentBudget.types'
import * as CurrentBudgetCompound from './CurrentBudget.compound'

export function CurrentBudget({
  budgetName,
  budgetMonth,
  currentAmount,
  startingAmount,
  spentAmount,
  spentPercentage,
  daysLeft,
  onClick,
  onEdit,
  linkProvider: LinkProvider,
}: CurrentBudgetProps) {
  return (
    <CurrentBudgetCompound.Root>
      <CurrentBudgetCompound.Header>
        <div className="flex flex-col gap-0.5">
          <CurrentBudgetCompound.Title>
            {LinkProvider ? (
              <LinkProvider>
                {budgetMonth ?? 'Current Budget'}
              </LinkProvider>
            ) : (
              budgetMonth ?? 'Current Budget'
            )}
          </CurrentBudgetCompound.Title>
          <CurrentBudgetCompound.Period onEdit={onEdit}>
            {budgetName}
          </CurrentBudgetCompound.Period>
        </div>
        {typeof daysLeft === 'number' && (
          <CurrentBudgetCompound.Action>
            <CurrentBudgetCompound.DaysLeftBadge
              daysLeft={daysLeft}
              size="sm"
            />
          </CurrentBudgetCompound.Action>
        )}
      </CurrentBudgetCompound.Header>
      <CurrentBudgetCompound.Remaining
        amount={currentAmount}
        of={startingAmount}
        onClick={onClick}
      />
      <CurrentBudgetCompound.Footer>
        <CurrentBudgetCompound.Spent amount={spentAmount} />
        <CurrentBudgetCompound.Percentage value={spentPercentage} />
      </CurrentBudgetCompound.Footer>
      <CurrentBudgetCompound.ProgressBar percentage={spentPercentage} />
    </CurrentBudgetCompound.Root>
  )
}
