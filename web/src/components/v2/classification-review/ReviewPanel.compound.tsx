import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { CardContent, CardFooter } from '@/components/ui/card'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils/cn'

import type { CategoryOption } from '../shared/Review.types'

export {
  Confidence,
  Header,
  Merchant,
  Root,
  Statement,
  Title,
} from './ReviewCard.compound'

type NavProps = {
  onPrev?: () => void
  onNext?: () => void
  className?: string
}

export function Nav({ onPrev, onNext, className }: NavProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous transaction"
        className="text-muted-foreground size-8"
        onClick={onPrev}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next transaction"
        className="text-muted-foreground size-8"
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
    <CardContent className={cn('space-y-2', className)}>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
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

type CountsTowardBudgetProps = {
  checked: boolean
  modelProbability: number
  onCheckedChange?: (checked: boolean) => void
  className?: string
}

export function CountsTowardBudget({
  checked,
  modelProbability,
  onCheckedChange,
  className,
}: CountsTowardBudgetProps) {
  return (
    <CardContent className={className}>
      <div
        className="border-border bg-input/40 flex items-center justify-between
          gap-4 rounded-2xl border p-4 [box-shadow:var(--input-groove)]"
      >
        <div className="space-y-1">
          <p className="font-grotesk text-sm font-semibold">
            Counts toward budget
          </p>
          <p className="text-muted-foreground text-xs">
            Model says {modelProbability}% likely an expense
          </p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label="Counts toward budget"
        />
      </div>
    </CardContent>
  )
}

type ActionsProps = ComponentProps<typeof CardContent>

export function Actions({ className, ...props }: ActionsProps) {
  return <CardContent className={className} {...props} />
}

type FooterProps = ComponentProps<typeof CardFooter>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <CardFooter
      className={cn('items-center justify-between', className)}
      {...props}
    />
  )
}
