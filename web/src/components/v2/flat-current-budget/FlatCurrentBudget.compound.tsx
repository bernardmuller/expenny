import { ChevronRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/v2/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/v2/ui/card'
import { Progress } from '@/components/v2/ui/progress'
import { cn } from '@/lib/utils/cn'
import { formatPercentage } from '@/lib/utils/formatting/formatPercentage'

import { DaysLeftBadge } from '../current-budget/CurrentBudget.compound'

export { DaysLeftBadge }

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return (
    <Card
      className={cn(
        `flex-col gap-5 px-5 py-5 md:flex-row md:flex-wrap md:items-center
        md:justify-between md:gap-10 md:px-7 md:py-6`,
        className,
      )}
      {...props}
    />
  )
}

type InfoProps = {
  children: ReactNode
  className?: string
}

export function Info({ children, className }: InfoProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-0.5 md:min-w-[150px]',
        className,
      )}
    >
      {children}
    </div>
  )
}

type TitleProps = {
  children: ReactNode
  className?: string
}

export function Title({ children, className }: TitleProps) {
  return (
    <CardTitle
      className={cn(
        'text-foreground flex items-center gap-1 text-lg font-semibold',
        className,
      )}
    >
      {children}
    </CardTitle>
  )
}

export function Period({
  children,
  className,
  onEdit,
}: {
  children: ReactNode
  className?: string
  onEdit?: () => void
}) {
  const classes = cn('text-muted-foreground text-sm', className)

  if (!onEdit) {
    return <CardDescription className={classes}>{children}</CardDescription>
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

type RemainingProps = {
  amount: string
  of: string
  onClick?: () => void
  className?: string
}

export function Remaining({ amount, of, onClick, className }: RemainingProps) {
  const amountClass =
    'text-primary font-display text-[50px] leading-none font-semibold tracking-[2px]'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1',
        className,
      )}
    >
      {onClick ? (
        <Button
          variant="ghost"
          onClick={onClick}
          aria-label="Toggle remaining amount visibility"
          className="h-auto rounded-none p-0 hover:bg-transparent"
        >
          <span className={amountClass}>{amount}</span>
        </Button>
      ) : (
        <span className={amountClass}>{amount}</span>
      )}
      <span className="text-muted-foreground text-[15px]">
        remaining of {of}
      </span>
    </div>
  )
}

type SpentProps = {
  amount: string
  percentage: number
  className?: string
}

export function Spent({ amount, percentage, className }: SpentProps) {
  const clamped = Math.min(Math.max(percentage, 0), 100)

  return (
    <div
      className={cn('flex w-full min-w-0 flex-1 flex-col gap-2.5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">Spent: {amount}</span>
        <span className="text-foreground text-sm font-semibold">
          {formatPercentage(percentage)}
        </span>
      </div>
      <Progress value={clamped} aria-valuenow={clamped} showTicks />
    </div>
  )
}

export function Chevron() {
  return <ChevronRight className="size-4.5 shrink-0" />
}
