import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import * as ReviewPanelCompound from './ReviewPanel.compound'
import type { ReviewPanelProps } from '../shared/Review.types'

export function ReviewPanel({
  item,
  index,
  total,
  displayName,
  categoryId,
  categoryOptions,
  countsTowardBudget,
  onDisplayNameChange,
  onCategoryChange,
  onCountsTowardBudgetChange,
  onPrev,
  onNext,
  onConfirm,
  onSkip,
}: ReviewPanelProps) {
  return (
    <ReviewPanelCompound.Root>
      <ReviewPanelCompound.Header>
        <ReviewPanelCompound.Title>
          Needs review · {index + 1} of {total}
        </ReviewPanelCompound.Title>
        <ReviewPanelCompound.Nav onPrev={onPrev} onNext={onNext} />
      </ReviewPanelCompound.Header>
      <ReviewPanelCompound.Merchant
        emoji={item.emoji}
        name={item.merchant}
        date={item.date}
        amount={item.amount}
      />
      <ReviewPanelCompound.Statement>
        {item.originalDescription}
      </ReviewPanelCompound.Statement>
      <ReviewPanelCompound.Field label="Display name">
        <Input
          value={displayName}
          onChange={(event) => onDisplayNameChange?.(event.target.value)}
        />
      </ReviewPanelCompound.Field>
      <ReviewPanelCompound.CategoryField
        value={categoryId}
        options={categoryOptions}
        onChange={onCategoryChange}
      />
      <ReviewPanelCompound.Confidence
        value={item.confidence}
        className="px-6"
      />
      <ReviewPanelCompound.CountsTowardBudget
        checked={countsTowardBudget}
        modelProbability={item.expenseProbability}
        onCheckedChange={onCountsTowardBudgetChange}
      />
      <ReviewPanelCompound.Actions>
        <Button className="w-full" onClick={onConfirm}>
          <Check />
          Confirm and next
        </Button>
      </ReviewPanelCompound.Actions>
      <ReviewPanelCompound.Footer>
        <span className="text-muted-foreground text-xs">
          Balance after: {item.balanceAfter}
        </span>
        <Button
          variant="link"
          className="text-muted-foreground h-auto p-0 text-xs"
          onClick={onSkip}
        >
          Skip for now
        </Button>
      </ReviewPanelCompound.Footer>
    </ReviewPanelCompound.Root>
  )
}
