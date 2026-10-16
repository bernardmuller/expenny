import { Check } from 'lucide-react'

import { Button } from '@/components/v2/ui/button'
import { Input } from '@/components/v2/ui/input'

import { filterCategoryOptionsByDirection } from '../shared/categories'
import * as ReviewPanelCompound from './ReviewPanel.compound'
import type { ReviewPanelProps } from '../shared/Review.types'

export function ReviewPanel({
  item,
  index,
  total,
  displayName,
  categoryId,
  groupKey,
  categoryOptions,
  onDisplayNameChange,
  onCategoryChange,
  onPrev,
  onNext,
  onConfirm,
  onSkip,
}: ReviewPanelProps) {
  const options = filterCategoryOptionsByDirection(
    categoryOptions,
    item.isIncome,
  )

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
        category={item.category.label}
        size="md"
      />
      <ReviewPanelCompound.Statement
        date={item.date}
        amount={item.amount}
        merchant={item.merchant}
        category={item.category.label}
      >
        {item.originalDescription}
      </ReviewPanelCompound.Statement>
      <ReviewPanelCompound.Field label="Display name">
        <Input
          value={displayName}
          onChange={(event) => onDisplayNameChange?.(event.target.value)}
        />
      </ReviewPanelCompound.Field>
      <ReviewPanelCompound.Classification inline label="We think it's">
        <ReviewPanelCompound.Confidence value={item.confidence} />
      </ReviewPanelCompound.Classification>
      <ReviewPanelCompound.CategoryGrid
        value={categoryId}
        groupKey={groupKey}
        options={options}
        onChange={onCategoryChange}
      />
      <ReviewPanelCompound.Actions>
        <Button size="lg" className="w-full text-[17px]" onClick={onConfirm}>
          <Check />
          Confirm and next
        </Button>
      </ReviewPanelCompound.Actions>
      <ReviewPanelCompound.Footer>
        <span className="text-muted-foreground text-[13px]">
          Balance after: {item.balanceAfter}
        </span>
        <Button
          variant="link"
          className="text-muted-foreground h-auto p-0 text-[13px]"
          onClick={onSkip}
        >
          Skip for now
        </Button>
      </ReviewPanelCompound.Footer>
    </ReviewPanelCompound.Root>
  )
}
