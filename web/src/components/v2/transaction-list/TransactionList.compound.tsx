import type { ComponentProps, ReactNode } from 'react'

import { Badge } from '@/components/v2/ui/badge'
import { Button } from '@/components/v2/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/v2/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/v2/ui/item'
import { Toggle } from '@/components/v2/ui/toggle'
import { cn } from '@/lib/utils/cn'

import { categoryTint } from '../shared/categories'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return <Card className={cn('gap-0 px-5 pt-5 pb-3.5', className)} {...props} />
}

type HeaderProps = ComponentProps<typeof CardHeader>

export function Header({ className, ...props }: HeaderProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-row items-center justify-between gap-3 px-0 pb-0.5',
        className,
      )}
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
      className={cn('text-primary h-11 p-0 text-[15px]', className)}
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
        `-mx-5 flex gap-2.5 overflow-x-auto px-5 pt-0.5 pb-2
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`,
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
        `border-border bg-raised text-card-foreground
        data-[state=on]:border-primary data-[state=on]:bg-primary
        data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary
        data-[state=on]:hover:text-primary-foreground h-11 shrink-0 rounded-full
        border px-4.5 text-sm font-semibold [box-shadow:0_3px_0_var(--lip-sm)]
        data-[state=on]:font-bold
        data-[state=on]:[box-shadow:0_3px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]`,
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
  return <CardContent className={cn('p-0', className)}>{children}</CardContent>
}

type RowProps = ComponentProps<typeof Item> & {
  dimmed?: boolean
}

export function Row({ className, dimmed = false, ...props }: RowProps) {
  return (
    <Item
      size="sm"
      className={cn(
        `hover:bg-raised/40 border-t-border flex cursor-pointer gap-3
        rounded-none border-t border-b-0 px-0 py-2.5`,
        dimmed && 'opacity-60',
        className,
      )}
      {...props}
    />
  )
}

type RowEmojiProps = ComponentProps<typeof ItemMedia> & {
  category?: string
}

export function RowEmoji({ category, className, ...props }: RowEmojiProps) {
  const tint = categoryTint(category)

  return (
    <ItemMedia
      className={cn(
        `flex size-11 shrink-0 translate-y-0 items-center justify-center
        self-center rounded-[14px] border text-xl`,
        className,
      )}
      style={{
        backgroundColor: tint.background,
        borderColor: tint.border,
        boxShadow: `0 3px 0 ${tint.lip}`,
      }}
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
      className={cn('text-base font-semibold', className)}
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
      className={cn('flex items-center gap-2 text-[13px]', className)}
      {...props}
    />
  )
}

type RowCategoryProps = {
  label: string
  className?: string
}

export function RowCategory({ label, className }: RowCategoryProps) {
  const tint = categoryTint(label)

  return (
    <span
      className={cn('text-[13px] font-semibold', className)}
      style={{ color: tint.color }}
    >
      {label}
    </span>
  )
}

type RowAmountProps = {
  amount: string
  meta: string
  muted?: boolean
  emphasis?: boolean
  className?: string
}

export function RowAmount({
  amount,
  meta,
  muted = false,
  emphasis = false,
  className,
}: RowAmountProps) {
  return (
    <ItemActions className={cn('flex-col items-end gap-0.5', className)}>
      <span
        className={cn(
          'font-display text-[17px] font-semibold',
          muted && 'text-muted-foreground',
          emphasis && 'text-primary',
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
    <Badge variant="gold" className={cn('h-5 px-2 text-xs', className)}>
      Review
    </Badge>
  )
}
