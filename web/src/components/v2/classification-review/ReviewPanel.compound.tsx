import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/v2/ui/button'
import { Card, CardContent, CardFooter } from '@/components/v2/ui/card'
import { SearchableSelect } from '@/components/v2/ui/searchable-select'
import { cn } from '@/lib/utils/cn'

import {
  categoryTint,
  groupCategoryOptions,
  withAlpha,
} from '../shared/categories'
import { useCategoryColor } from '../shared/CategoryColors'
import type { CategoryOption } from '../shared/Review.types'

export {
  Classification,
  Confidence,
  Header,
  Merchant,
  Statement,
  Title,
} from './ReviewCard.compound'

type RootProps = ComponentProps<typeof Card>

/** Desktop panel variant of the review card: 22px padding, 18px gap. */
export function Root({ className, ...props }: RootProps) {
  return (
    <Card
      variant="highlight"
      className={cn('gap-[18px] p-[22px]', className)}
      {...props}
    />
  )
}

type NavProps = {
  onPrev?: () => void
  onNext?: () => void
  className?: string
}

export function Nav({ onPrev, onNext, className }: NavProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <Button
        variant="secondary"
        size="icon"
        aria-label="Previous transaction"
        className="text-card-foreground border-border bg-raised size-11
          rounded-[14px] [box-shadow:0_3px_0_var(--lip-sm)] [&_svg]:size-5"
        onClick={onPrev}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        aria-label="Next transaction"
        className="text-card-foreground border-border bg-raised size-11
          rounded-[14px] [box-shadow:0_3px_0_var(--lip-sm)] [&_svg]:size-5"
        onClick={onNext}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

type FieldProps = {
  label: string
  children: ReactNode
  className?: string
}

export function Field({ label, children, className }: FieldProps) {
  return (
    <CardContent className={cn('space-y-2 px-0', className)}>
      <p
        className="text-muted-foreground text-xs font-semibold tracking-[0.06em]
          uppercase"
      >
        {label}
      </p>
      {children}
    </CardContent>
  )
}

type CategoryFieldProps = {
  value: string
  options: Array<CategoryOption>
  onChange?: (value: string) => void
  className?: string
}

export function CategoryField({
  value,
  options,
  onChange,
  className,
}: CategoryFieldProps) {
  return (
    <Field label="Category" className={className}>
      <SearchableSelect
        options={options}
        value={value}
        onChange={(next) => onChange?.(next)}
        placeholder="Select category"
      />
    </Field>
  )
}

function splitOptionLabel(label: string) {
  const match = label.match(/^(\S+)\s+(.*)$/)
  if (!match) return { icon: '', label }

  const [, first, rest] = match
  // Only treat the first token as an icon when it is not plain text.
  return /\p{Emoji}/u.test(first)
    ? { icon: first, label: rest }
    : { icon: '', label }
}

type CategoryGridProps = {
  value: string
  groupKey?: string
  options: Array<CategoryOption>
  onChange?: (categoryId: string, groupKey: string) => void
  className?: string
}

export function CategoryGrid({
  value,
  groupKey,
  options,
  onChange,
  className,
}: CategoryGridProps) {
  const groups = groupCategoryOptions(options)

  return (
    <CardContent className={cn('px-0', className)}>
      <div className="max-h-80 overflow-y-auto pr-1.5">
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-label={group.label}
              className="space-y-2"
            >
              <p
                className="text-muted-foreground text-xs font-semibold
                  tracking-[0.06em] uppercase"
              >
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {group.options.map((option) => (
                  <CategoryOptionButton
                    key={option.value}
                    option={option}
                    selected={
                      option.value === value && option.groupKey === groupKey
                    }
                    onChange={onChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  )
}

type CategoryOptionButtonProps = {
  option: CategoryOption
  selected: boolean
  onChange?: (categoryId: string, groupKey: string) => void
}

function CategoryOptionButton({
  option,
  selected,
  onChange,
}: CategoryOptionButtonProps) {
  const { icon, label } = splitOptionLabel(option.label)
  const tint = categoryTint(label, useCategoryColor(label))

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onChange?.(option.value, option.groupKey ?? '')}
      className={cn(
        `focus-visible:ring-primary/40 flex h-[46px] items-center gap-2
        rounded-[14px] border px-3 text-left text-sm font-semibold
        transition-all outline-none focus-visible:ring-[3px]`,
        selected
          ? 'translate-y-[3px]'
          : `bg-raised border-border text-card-foreground
            [box-shadow:0_3px_0_var(--lip-sm)]`,
      )}
      style={
        selected
          ? {
              color: tint.color,
              backgroundColor: withAlpha(tint.color, 0.18),
              borderColor: withAlpha(tint.color, 0.6),
            }
          : undefined
      }
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </button>
  )
}

type ActionsProps = ComponentProps<typeof CardContent>

export function Actions({ className, ...props }: ActionsProps) {
  return <CardContent className={cn('px-0', className)} {...props} />
}

type FooterProps = ComponentProps<typeof CardFooter>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <CardFooter
      className={cn('items-center justify-between px-0', className)}
      {...props}
    />
  )
}
