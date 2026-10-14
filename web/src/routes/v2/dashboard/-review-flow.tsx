import { useState } from 'react'

import { ReviewCard } from '@/components/v2/classification-review/ReviewCard'
import { ReviewPanel } from '@/components/v2/classification-review/ReviewPanel'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/v2/ui/sheet'
import type {
  CategoryOption,
  ReviewItem,
} from '@/components/v2/shared/Review.types'

type ReviewFlowProps = {
  item: ReviewItem
  index: number
  total: number
  isMobile: boolean
  categoryOptions: Array<CategoryOption>
  onConfirm: (categoryId: string, isExpense: boolean) => void
  onSkip: () => void
  onPrev: () => void
  onNext: () => void
}

/**
 * Owns the editable state for the transaction currently being reviewed. The
 * dashboard keys this component on the transaction id, so moving to the next
 * item starts from that item's suggested values.
 */
export function ReviewFlow({
  item,
  index,
  total,
  isMobile,
  categoryOptions,
  onConfirm,
  onSkip,
  onPrev,
  onNext,
}: ReviewFlowProps) {
  const [displayName, setDisplayName] = useState(item.merchant)
  const [categoryId, setCategoryId] = useState(item.category.id)
  const [countsTowardBudget, setCountsTowardBudget] = useState(item.isExpense)
  const [changeOpen, setChangeOpen] = useState(false)

  const confirm = () => {
    setChangeOpen(false)
    onConfirm(categoryId, countsTowardBudget)
  }

  const panel = (
    <ReviewPanel
      item={item}
      index={index}
      total={total}
      displayName={displayName}
      categoryId={categoryId}
      categoryOptions={categoryOptions}
      countsTowardBudget={countsTowardBudget}
      onDisplayNameChange={setDisplayName}
      onCategoryChange={setCategoryId}
      onCountsTowardBudgetChange={setCountsTowardBudget}
      onPrev={onPrev}
      onNext={onNext}
      onConfirm={confirm}
      onSkip={onSkip}
    />
  )

  if (!isMobile) return panel

  return (
    <>
      <ReviewCard
        item={item}
        index={index}
        total={total}
        onLooksRight={confirm}
        onChange={() => setChangeOpen(true)}
        onNotExpense={() => {
          setChangeOpen(false)
          onConfirm(categoryId, false)
        }}
        onSkip={onSkip}
      />
      <Sheet open={changeOpen} onOpenChange={setChangeOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92svh] overflow-y-auto p-4"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Change category</SheetTitle>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
    </>
  )
}
