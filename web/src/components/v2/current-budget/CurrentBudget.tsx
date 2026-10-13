import type { CurrentBudgetProps } from './CurrentBudget.types'
import * as CurrentBudgetCompound from './CurrentBudget.compound'

export function CurrentBudget({
  budgetName,
  currentAmount,
  startingAmount,
  spentAmount,
  spentPercentage,
  daysLeft,
  onClick,
  linkProvider: LinkProvider,
}: CurrentBudgetProps) {
  const title = `Current Budget · ${budgetName}`

  return (
    <CurrentBudgetCompound.Root>
      <CurrentBudgetCompound.Header>
        <CurrentBudgetCompound.Title>
          {LinkProvider ? <LinkProvider>{title}</LinkProvider> : title}
        </CurrentBudgetCompound.Title>
        {typeof daysLeft === 'number' && (
          <CurrentBudgetCompound.Action>
            <CurrentBudgetCompound.DaysLeftBadge daysLeft={daysLeft} />
          </CurrentBudgetCompound.Action>
        )}
      </CurrentBudgetCompound.Header>
      <CurrentBudgetCompound.Remaining
        amount={currentAmount}
        of={startingAmount}
        onClick={onClick}
      />
      <CurrentBudgetCompound.ProgressBar percentage={spentPercentage} />
      <CurrentBudgetCompound.Footer>
        <CurrentBudgetCompound.Spent amount={spentAmount} />
        <CurrentBudgetCompound.Percentage value={spentPercentage} />
      </CurrentBudgetCompound.Footer>
    </CurrentBudgetCompound.Root>
  )
}
