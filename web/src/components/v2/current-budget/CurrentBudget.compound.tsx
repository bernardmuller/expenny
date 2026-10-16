import { Calendar, ChevronRight } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Badge } from '@/components/v2/ui/badge'
import { Button } from '@/components/v2/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/v2/ui/card'
import { Progress } from '@/components/v2/ui/progress'
import { cn } from '@/lib/utils/cn'
import { formatPercentage } from '@/lib/utils/formatting/formatPercentage'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return <Card className={cn('gap-[18px] px-5 py-5', className)} {...props} />
}

type HeaderProps = ComponentProps<typeof CardHeader>

export function Header({ className, ...props }: HeaderProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-row items-start justify-between gap-3 px-0',
        className,
      )}
      {...props}
    />
  )
}

type ActionProps = ComponentProps<typeof CardAction>

export function Action({ className, ...props }: ActionProps) {
  return <CardAction className={className} {...props} />
}

type TitleProps = ComponentProps<typeof CardTitle>

export function Title({ className, children, ...props }: TitleProps) {
  return (
    <CardTitle
      className={cn(
        'text-foreground flex items-center gap-1 text-lg font-semibold',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="size-4.5 shrink-0" />
    </CardTitle>
  )
}

export function getDaysLeftLabel(daysLeft: number) {
  if (daysLeft === 0) return 'Budget End'
  if (daysLeft === -1) return 'Ended Yesterday'
  if (daysLeft < 0) return `${Math.abs(daysLeft)} days past`
  if (daysLeft === 1) return 'Ends Tomorrow'
  return `${daysLeft} days left`
}

type DaysLeftBadgeProps = ComponentProps<typeof Badge> & {
  daysLeft: number
  size?: 'sm' | 'md'
}

export function DaysLeftBadge({
  daysLeft,
  size = 'md',
  className,
  ...props
}: DaysLeftBadgeProps) {
  const hasEnded = daysLeft <= 0

  return (
    <Badge
      variant={hasEnded ? 'destructive' : 'secondary'}
      className={cn(
        'gap-2 rounded-full text-[13px] font-semibold',
        '[box-shadow:0_3px_0_var(--lip-sm)]',
        size === 'sm' ? 'h-8.5 px-3' : 'h-9 px-3.5',
        className,
      )}
      {...props}
    >
      {daysLeft !== 0 && <Calendar className="size-3.5!" />}
      {getDaysLeftLabel(daysLeft)}
    </Badge>
  )
}

type ContentProps = ComponentProps<typeof CardContent>

export function Content({ className, ...props }: ContentProps) {
  return <CardContent className={cn('px-0', className)} {...props} />
}

type PeriodProps = ComponentProps<typeof CardDescription> & {
  onEdit?: () => void
}

export function Period({ className, onEdit, children, ...props }: PeriodProps) {
  const classes = cn('text-muted-foreground text-sm', className)

  if (!onEdit) {
    return (
      <CardDescription className={classes} {...props}>
        {children}
      </CardDescription>
    )
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        classes,
        `hover:text-foreground w-fit underline decoration-dotted
        underline-offset-4 transition-colors`,
      )}
    >
      {children}
    </button>
  )
}

type RemainingProps = ComponentProps<typeof CardContent> & {
  amount: string
  of: string
  onClick?: () => void
}

export function Remaining({
  amount,
  of,
  onClick,
  className,
  ...props
}: RemainingProps) {
  return (
    <CardContent
      className={cn('flex flex-col items-center gap-2 px-0', className)}
      {...props}
    >
      <Button
        variant="ghost"
        onClick={onClick}
        aria-label="Toggle remaining amount visibility"
        className="h-auto rounded-none p-0 hover:bg-transparent"
      >
        <span
          className="text-primary font-display text-[44px] leading-none
            font-semibold tracking-[2px]"
        >
          {amount}
        </span>
      </Button>
      <span className="text-muted-foreground text-[15px]">
        remaining of {of}
      </span>
    </CardContent>
  )
}

type ProgressBarProps = {
  percentage: number
  className?: string
}

export function ProgressBar({ percentage, className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(percentage, 0), 100)

  return (
    <CardContent className={cn('px-0', className)}>
      <Progress
        value={clamped}
        aria-valuenow={clamped}
        showTicks
        className="h-[30px]"
      />
    </CardContent>
  )
}

type FooterProps = ComponentProps<typeof CardFooter>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <CardFooter
      className={cn('items-end justify-between px-0', className)}
      {...props}
    />
  )
}

type SpentProps = {
  amount: string
  className?: string
}

export function Spent({ amount, className }: SpentProps) {
  return (
    <span className={cn('text-muted-foreground text-sm', className)}>
      Spent {amount}
    </span>
  )
}

type PercentageProps = {
  value: number
  className?: string
}

export function Percentage({ value, className }: PercentageProps) {
  return (
    <span className={cn('text-foreground text-sm font-semibold', className)}>
      {formatPercentage(value)}
    </span>
  )
}
