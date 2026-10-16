import { Check } from 'lucide-react'

import { Button } from '@/components/v2/ui/button'

import * as ReviewCardCompound from './ReviewCard.compound'
import type { ReviewCardProps } from '../shared/Review.types'

export function ReviewCard({
  item,
  index,
  total,
  onLooksRight,
  onChange,
  onSkip,
}: ReviewCardProps) {
  return (
    <ReviewCardCompound.Root>
      <ReviewCardCompound.Header>
        <ReviewCardCompound.Title>{total} to review</ReviewCardCompound.Title>
        <ReviewCardCompound.StepMeter total={total} current={index + 1} />
      </ReviewCardCompound.Header>
      <ReviewCardCompound.Merchant
        emoji={item.emoji}
        name={item.merchant}
        date={item.date}
        amount={item.amount}
        category={item.category.label}
      />
      <ReviewCardCompound.Statement
        date={item.date}
        amount={item.amount}
        merchant={item.merchant}
        category={item.category.label}
      >
        {item.originalDescription}
      </ReviewCardCompound.Statement>
      <ReviewCardCompound.Classification>
        <ReviewCardCompound.CategoryPill
          icon={item.category.icon}
          label={item.category.label}
        />
        <ReviewCardCompound.Confidence value={item.confidence} />
      </ReviewCardCompound.Classification>
      <ReviewCardCompound.Actions>
        <Button
          size="lg"
          className="flex-1 [&_svg]:size-4.5"
          onClick={onLooksRight}
        >
          <Check />
          Looks right
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={onChange}
        >
          Change
        </Button>
      </ReviewCardCompound.Actions>
      <ReviewCardCompound.Footer>
        <ReviewCardCompound.LinkAction onClick={onSkip}>
          Skip for now
        </ReviewCardCompound.LinkAction>
      </ReviewCardCompound.Footer>
    </ReviewCardCompound.Root>
  )
}
