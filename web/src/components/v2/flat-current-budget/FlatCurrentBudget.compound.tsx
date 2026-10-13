import { ChevronRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

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
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <CardDescription className={cn('text-muted-foreground text-sm', className)}>
      {children}
    </CardDescription>
  )
}

type RemainingProps = {
  amount: string
  of: string
  className?: string
}

export function Remaining({ amount, of, className }: RemainingProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1',
        className,
      )}
    >
      <span
        className="text-primary font-display text-[50px] leading-none
          font-semibold tracking-[2px]"
      >
        {amount}
      </span>
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
