import { Check, ChevronDown, Search } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Badge } from '@/components/v2/ui/badge'
import { Button } from '@/components/v2/ui/button'
import { Card, CardContent, CardFooter } from '@/components/v2/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/v2/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/v2/ui/input-group'
import { cn } from '@/lib/utils/cn'

import { categoryTint } from '../shared/categories'
import { useCategoryColor } from '../shared/CategoryColors'
import { CategoryPicker as SharedCategoryPicker } from '../shared/CategoryPicker'
import { ConfidenceStat } from '../shared/ConfidenceBar'
import type { CategoryOption } from '../shared/Review.types'
import type { TransactionFilter } from '../shared/Transaction.types'

export {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/v2/ui/table'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return (
    <Card
      className={cn('gap-0 overflow-hidden px-5 pt-5 pb-3', className)}
      {...props}
    />
  )
}

type FilterMenuProps = {
  filters: Array<TransactionFilter>
  value: string
  onValueChange?: (value: string) => void
  className?: string
}

/** The view selector that used to be a row of chips, now next to search. */
export function FilterMenu({
  filters,
  value,
  onValueChange,
  className,
}: FilterMenuProps) {
  const active = filters.find((filter) => filter.id === value) ?? filters.at(0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn('h-10 gap-2 rounded-full px-4', className)}
        >
          {active?.label}
          {typeof active?.count === 'number' && (
            <span className="text-muted-foreground text-[13px]">
              · {active.count}
            </span>
          )}
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel
          className="text-muted-foreground text-xs font-semibold
            tracking-[0.06em] uppercase"
        >
          Show
        </DropdownMenuLabel>
        {filters.map((filter) => {
          const selected = filter.id === value

          return (
            <DropdownMenuItem
              key={filter.id}
              onSelect={() => onValueChange?.(filter.id)}
              className={cn(
                filter.id === 'review' && 'text-chart-3 font-semibold',
              )}
            >
              <Check className={cn('size-4', !selected && 'opacity-0')} />
              {filter.label}
              {typeof filter.count === 'number' && (
                <span className="text-muted-foreground ml-auto text-[13px]">
                  · {filter.count}
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type SearchFieldProps = {
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function SearchField({ value, onChange, className }: SearchFieldProps) {
  return (
    <InputGroup className={cn('h-10 w-47.5 max-w-full', className)}>
      <InputGroupAddon className="text-muted-foreground pr-0 pl-3.5">
        <Search className="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder="Search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="text-[15px]"
      />
    </InputGroup>
  )
}

export function Content({
  className,
  ...props
}: ComponentProps<typeof CardContent>) {
  // No top padding: the sticky table header has to sit flush with the scroll
  // port, otherwise rows scroll up through the gap above it.
  return <CardContent className={cn('px-0', className)} {...props} />
}

type FooterProps = ComponentProps<typeof CardFooter>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <CardFooter
      className={cn(
        `border-border mt-1.5 items-center justify-between border-t px-3 pt-2.5
        pb-1`,
        className,
      )}
      {...props}
    />
  )
}

type MerchantCellProps = {
  emoji: string
  description: string
  originalDescription?: string
  category?: string
  className?: string
}

export function MerchantCell({
  emoji,
  description,
  originalDescription,
  category,
  className,
}: MerchantCellProps) {
  const tint = categoryTint(category, useCategoryColor(category))

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        aria-hidden="true"
        className="flex size-9.5 shrink-0 items-center justify-center rounded-xl
          border text-lg"
        style={{
          backgroundColor: tint.background,
          borderColor: tint.border,
          boxShadow: `0 3px 0 ${tint.lip}`,
        }}
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{description}</p>
        {originalDescription && (
          <p
            className="text-muted-foreground font-statement truncate
              text-[11.5px]"
          >
            {originalDescription}
          </p>
        )}
      </div>
    </div>
  )
}

type CategoryPillProps = {
  icon?: string
  label: string
  className?: string
}

export function CategoryPill({ icon, label, className }: CategoryPillProps) {
  const tint = categoryTint(label, useCategoryColor(label))

  return (
    <Badge
      variant="outline"
      className={cn('h-6.5 gap-1.5 border px-2.5', className)}
      style={{
        color: tint.color,
        backgroundColor: tint.background,
        borderColor: tint.border,
      }}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </Badge>
  )
}

type CategoryPickerProps = {
  label: string
  value: string
  groupKey?: string
  options: Array<CategoryOption>
  onChange?: (categoryId: string, groupKey: string) => void
  className?: string
}

/** Category pill that opens a dropdown to recategorise the transaction. */
export function CategoryPicker({
  label,
  value,
  groupKey,
  options,
  onChange,
  className,
}: CategoryPickerProps) {
  return (
    <SharedCategoryPicker
      label={label}
      value={value}
      groupKey={groupKey}
      options={options}
      onChange={onChange}
      className={className}
      trigger={<CategoryPill label={label} />}
    />
  )
}

type ConfidenceCellProps = {
  value: number
  className?: string
}

export function ConfidenceCell({ value, className }: ConfidenceCellProps) {
  return (
    <ConfidenceStat
      value={value}
      size="sm"
      label={`${value}%`}
      className={cn(
        `[&>span:last-child]:w-8 [&>span:last-child]:text-right
        [&>span:last-child]:text-xs`,
        className,
      )}
    />
  )
}
