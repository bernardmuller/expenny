import type { ComponentProps, ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils/cn'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return <Card className={className} {...props} />
}

type HeaderProps = ComponentProps<typeof CardHeader>

export function Header({ className, ...props }: HeaderProps) {
  return (
    <CardHeader
      className={cn('flex-row items-center justify-between gap-3', className)}
      {...props}
    />
  )
}

type TitleProps = ComponentProps<typeof CardTitle>

export function Title({ className, ...props }: TitleProps) {
  return <CardTitle className={cn('text-lg', className)} {...props} />
}

type ViewAllProps = ComponentProps<typeof Button>

export function ViewAll({ className, ...props }: ViewAllProps) {
  return (
    <Button
      variant="link"
      className={cn('text-primary h-auto p-0 text-sm', className)}
      {...props}
    />
  )
}

type FiltersProps = {
  children: ReactNode
  className?: string
}

export function Filters({ children, className }: FiltersProps) {
  return (
    <CardContent
      className={cn(
        `flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]
        [&::-webkit-scrollbar]:hidden`,
        className,
      )}
    >
      {children}
    </CardContent>
  )
}

type FilterProps = ComponentProps<typeof Toggle>

export function Filter({ className, ...props }: FilterProps) {
  return (
    <Toggle
      className={cn(
        `border-border data-[state=on]:border-primary data-[state=on]:bg-primary
        data-[state=on]:text-primary-foreground h-9 shrink-0 rounded-full border
        px-4 text-sm font-medium`,
        className,
      )}
      {...props}
    />
  )
}

type ListProps = {
  children: ReactNode
  className?: string
}

export function List({ children, className }: ListProps) {
  return (
    <CardContent className={cn('divide-border divide-y p-2', className)}>
      {children}
    </CardContent>
  )
}

type RowProps = ComponentProps<typeof Item> & {
  dimmed?: boolean
}

export function Row({ className, dimmed = false, ...props }: RowProps) {
  return (
    <Item
      size="sm"
      className={cn('cursor-pointer px-2', dimmed && 'opacity-50', className)}
      {...props}
    />
  )
}

type RowEmojiProps = ComponentProps<typeof ItemMedia>

export function RowEmoji({ className, ...props }: RowEmojiProps) {
  return (
    <ItemMedia
      className={cn(
        'bg-muted size-11 rounded-2xl text-lg [box-shadow:var(--input-groove)]',
        className,
      )}
      {...props}
    />
  )
}

export function RowContent({
  className,
  ...props
}: ComponentProps<typeof ItemContent>) {
  return <ItemContent className={className} {...props} />
}

export function RowTitle({
  className,
  ...props
}: ComponentProps<typeof ItemTitle>) {
  return (
    <ItemTitle
      className={cn('font-grotesk text-base font-semibold', className)}
      {...props}
    />
  )
}

export function RowMeta({
  className,
  ...props
}: ComponentProps<typeof ItemDescription>) {
  return (
    <ItemDescription
      className={cn('flex items-center gap-2 text-sm', className)}
      {...props}
    />
  )
}

type RowAmountProps = {
  amount: string
  meta: string
  muted?: boolean
  className?: string
}

export function RowAmount({
  amount,
  meta,
  muted = false,
  className,
}: RowAmountProps) {
  return (
    <ItemActions className={cn('flex-col items-end gap-0.5', className)}>
      <span
        className={cn(
          'font-grotesk font-semibold',
          muted && 'text-muted-foreground',
        )}
      >
        {amount}
      </span>
      <span className="text-muted-foreground text-xs">{meta}</span>
    </ItemActions>
  )
}

export function ReviewBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-chart-3/50 text-chart-3 rounded-full px-2 py-0.5 text-xs',
        className,
      )}
    >
      Review
    </Badge>
  )
}
