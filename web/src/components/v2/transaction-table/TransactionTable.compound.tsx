import { Search } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils/cn'

import { ConfidenceStat } from '../shared/ConfidenceBar'
import type { TransactionFilter } from '../shared/Transaction.types'

export { Table, TableBody, TableHeader, TableRow } from '@/components/ui/table'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return <Card className={cn('overflow-hidden', className)} {...props} />
}

type ToolbarProps = {
  children: ReactNode
  className?: string
}

export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <CardHeader
      className={cn(
        'flex-row flex-wrap items-center justify-between gap-3',
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
      <TabsList className="h-auto gap-2 bg-transparent p-0">
        {filters.map((filter) => (
          <TabsTrigger
            key={filter.id}
            value={filter.id}
            className="border-border data-[state=active]:border-primary
              data-[state=active]:bg-primary
              data-[state=active]:text-primary-foreground h-9 flex-none
              rounded-full border px-4"
          >
            {filter.label}
            {typeof filter.count === 'number' && (
              <span className="opacity-80">· {filter.count}</span>
            )}
          </TabsTrigger>
        ))}
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
    <InputGroup className={cn('h-10 w-full max-w-xs', className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder="Search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </InputGroup>
  )
}

export function Content({
  className,
  ...props
}: ComponentProps<typeof CardContent>) {
  return <CardContent className={cn('p-0', className)} {...props} />
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

type MerchantCellProps = {
  emoji: string
  description: string
  originalDescription?: string
  className?: string
}

export function MerchantCell({
  emoji,
  description,
  originalDescription,
  className,
}: MerchantCellProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="bg-muted flex size-10 shrink-0 items-center justify-center
          rounded-xl text-base [box-shadow:var(--input-groove)]"
      >
        {emoji}
      </div>
      <div className="min-w-0">
        <p className="font-grotesk max-w-40 truncate font-semibold">
          {description}
        </p>
        {originalDescription && (
          <p className="text-muted-foreground max-w-40 truncate text-xs">
            {originalDescription}
          </p>
        )}
      </div>
    </div>
  )
}

type CategoryPillProps = {
  icon: string
  label: string
  className?: string
}

export function CategoryPill({ icon, label, className }: CategoryPillProps) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 rounded-full px-2.5 py-1', className)}
    >
      <span>{icon}</span>
      {label}
    </Badge>
  )
}

export function ConfidenceCell({ value }: { value: number }) {
  return (
    <ConfidenceStat
      value={value}
      label={`${value}%`}
      className="[&>span]:w-9 [&>span]:text-right [&>span]:text-xs"
    />
  )
}
