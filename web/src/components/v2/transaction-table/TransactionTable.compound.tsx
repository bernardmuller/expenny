import { Check, Search } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Badge } from '@/components/v2/ui/badge'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/v2/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/v2/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/v2/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/v2/ui/tabs'
import { cn } from '@/lib/utils/cn'

import { categoryTint } from '../shared/categories'
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
      className={cn('gap-0 overflow-hidden px-4 pt-5 pb-3', className)}
      {...props}
    />
  )
}

type ToolbarProps = {
  children: ReactNode
  className?: string
}

export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-row flex-wrap items-center justify-between gap-3 px-3',
        className,
      )}
    >
      {children}
    </CardHeader>
  )
}

type FilterTabsProps = {
  filters: Array<TransactionFilter>
  value: string
  onValueChange?: (value: string) => void
  className?: string
}

export function FilterTabs({
  filters,
  value,
  onValueChange,
  className,
}: FilterTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn('w-fit', className)}
    >
      <TabsList className="h-auto gap-2.5 bg-transparent p-0">
        {filters.map((filter) => {
          const isReview = filter.id === 'review'

          return (
            <TabsTrigger
              key={filter.id}
              value={filter.id}
              className={cn(
                'h-10 flex-none rounded-full border px-4.5 text-sm',
                isReview
                  ? `border-chart-3/45 bg-chart-3/12 text-chart-3
                    hover:bg-chart-3/12 data-[state=active]:border-chart-3/45
                    data-[state=active]:bg-chart-3/12
                    data-[state=active]:text-chart-3 font-bold
                    [box-shadow:0_3px_0_color-mix(in_srgb,var(--color-chart-3)_18%,var(--color-card))]
                    data-[state=active]:font-bold
                    data-[state=active]:[box-shadow:0_3px_0_color-mix(in_srgb,var(--color-chart-3)_18%,var(--color-card))]`
                  : `border-border bg-raised text-card-foreground
                    hover:bg-raised hover:text-foreground
                    data-[state=active]:border-primary
                    data-[state=active]:bg-primary
                    data-[state=active]:text-primary-foreground font-semibold
                    [box-shadow:0_3px_0_var(--lip-sm)]
                    data-[state=active]:font-bold
                    data-[state=active]:[box-shadow:0_3px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]`,
              )}
            >
              {filter.label}
              {typeof filter.count === 'number' && (
                <span>· {filter.count}</span>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
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
  return <CardContent className={cn('px-0 pt-3', className)} {...props} />
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
  const tint = categoryTint(category)

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
  const tint = categoryTint(label)

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
  options: Array<CategoryOption>
  onChange?: (value: string) => void
  className?: string
}

/** Category pill that opens a dropdown to recategorise the transaction. */
export function CategoryPicker({
  label,
  value,
  options,
  onChange,
  className,
}: CategoryPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Change category for ${label}`}
          // Keep the row from selecting/reviewing when only the category is
          // being changed.
          onClick={(event) => event.stopPropagation()}
          className={cn(
            `focus-visible:ring-primary/40 cursor-pointer rounded-full
            transition-transform outline-none focus-visible:ring-[3px]
            active:translate-y-px`,
            className,
          )}
        >
          <CategoryPill label={label} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        // Portal events still bubble through the React tree, so keep menu
        // interactions from selecting the row underneath.
        onClick={(event) => event.stopPropagation()}
      >
        {options.map((option) => {
          const selected = option.value === value

          return (
            <DropdownMenuItem
              key={option.value}
              disabled={selected}
              onSelect={() => onChange?.(option.value)}
            >
              <Check className={cn('size-4', !selected && 'opacity-0')} />
              {option.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
