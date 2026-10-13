import { ChevronRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils/cn'
import { formatPercentage } from '@/lib/utils/formatting/formatPercentage'

import { DaysLeftBadge } from '../current-budget/CurrentBudget.compound'

export { DaysLeftBadge }

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return (
    <Card
      className={cn(
        `flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between
        md:gap-8`,
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
    <div className={cn('flex shrink-0 flex-col gap-1', className)}>
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
    <CardTitle className={cn('text-base font-semibold', className)}>
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
    <CardDescription className={cn('text-sm', className)}>
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
        'flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1',
        className,
      )}
    >
      <span
        className="text-primary font-grotesk text-4xl font-bold tracking-tight
          sm:text-5xl"
      >
        {amount}
      </span>
      <span className="text-muted-foreground text-lg">remaining of {of}</span>
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
      className={cn('flex w-full min-w-0 flex-1 flex-col gap-1.5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">Spent: {amount}</span>
        <span className="text-sm font-semibold">
          {formatPercentage(percentage)}
        </span>
      </div>
      <Progress value={clamped} aria-valuenow={clamped} className="h-2.5" />
    </div>
  )
}

export function Chevron() {
  return <ChevronRight className="size-4 shrink-0" />
}
