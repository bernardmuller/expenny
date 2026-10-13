import { Calendar } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils/cn'
import { formatPercentage } from '@/lib/utils/formatting/formatPercentage'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return <Card className={className} {...props} />
}

type HeaderProps = ComponentProps<typeof CardHeader>

export function Header({ className, ...props }: HeaderProps) {
  return <CardHeader className={className} {...props} />
}

type ActionProps = ComponentProps<typeof CardAction>

export function Action({ className, ...props }: ActionProps) {
  return <CardAction className={className} {...props} />
}

type TitleProps = ComponentProps<typeof CardTitle>

export function Title({ className, ...props }: TitleProps) {
  return (
    <CardTitle
      className={cn(
        'text-muted-foreground font-grotesk text-base font-medium sm:text-lg',
        className,
      )}
      {...props}
    />
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
}

export function DaysLeftBadge({
  daysLeft,
  className,
  ...props
}: DaysLeftBadgeProps) {
  const hasEnded = daysLeft <= 0

  return (
    <Badge
      variant={hasEnded ? 'destructive' : 'outline'}
      className={cn(
        'gap-2 rounded-full px-3 py-1.5 text-sm font-semibold [&>svg]:size-4',
        className,
      )}
      {...props}
    >
      {daysLeft !== 0 && <Calendar />}
      {getDaysLeftLabel(daysLeft)}
    </Badge>
  )
}

type ContentProps = ComponentProps<typeof CardContent>

export function Content({ className, ...props }: ContentProps) {
  return <CardContent className={className} {...props} />
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
      className={cn('flex flex-wrap items-end gap-x-3 gap-y-1', className)}
      {...props}
    >
      <Button
        variant="ghost"
        onClick={onClick}
        aria-label="Toggle remaining amount visibility"
        className="h-auto rounded-none p-0 hover:bg-transparent"
      >
        <span
          className="text-primary font-grotesk text-4xl font-bold tracking-tight
            sm:text-5xl"
        >
          {amount}
        </span>
      </Button>
      <span className="text-muted-foreground pb-1 text-base sm:text-lg">
        left of {of}
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
    <CardContent className={className}>
      <Progress value={clamped} aria-valuenow={clamped} className="h-3.5" />
    </CardContent>
  )
}

type FooterProps = ComponentProps<typeof CardFooter>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <CardFooter
      className={cn('items-end justify-between', className)}
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
    <span
      className={cn('text-muted-foreground text-sm sm:text-base', className)}
    >
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
    <span
      className={cn(
        'text-foreground font-grotesk text-lg font-bold sm:text-xl',
        className,
      )}
    >
      {formatPercentage(value)}
    </span>
  )
}
