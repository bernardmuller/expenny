import { ReceiptText } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/v2/ui/card'
import { cn } from '@/lib/utils/cn'

import { ConfidenceStat } from '../shared/ConfidenceBar'

// The statement blocks are shared with the review panel so both surfaces show
// a transaction the same way.
export {
  CategoryPill,
  Classification,
  Merchant,
  Statement,
} from '../classification-review/ReviewCard.compound'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return (
    <Card
      variant="default"
      className={cn('gap-[18px] p-[22px]', className)}
      {...props}
    />
  )
}

type HeaderProps = ComponentProps<typeof CardHeader>

export function Header({ className, ...props }: HeaderProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-row items-center justify-between gap-3 px-0',
        className,
      )}
      {...props}
    />
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
        'text-foreground flex items-center gap-2 text-base font-semibold',
        className,
      )}
    >
      <ReceiptText className="size-4.5" />
      {children}
    </CardTitle>
  )
}

type ConfidenceProps = {
  value: number
  className?: string
}

/** Auto-toned confidence: green above the trust threshold, amber below. */
export function Confidence({ value, className }: ConfidenceProps) {
  return (
    <ConfidenceStat
      value={value}
      size="md"
      className={className}
      label={`${value}% sure`}
    />
  )
}

type DetailRowProps = {
  label: string
  value: ReactNode
  hint?: string
  className?: string
}

export function DetailRow({ label, value, hint, className }: DetailRowProps) {
  return (
    <CardContent className={cn('px-0', className)}>
      <div
        className="border-border bg-muted flex items-center justify-between
          gap-4 rounded-2xl border px-3.5 py-3"
      >
        <div className="space-y-0.5">
          <p className="text-[15px] font-semibold">{label}</p>
          {hint && <p className="text-muted-foreground text-[13px]">{hint}</p>}
        </div>
        <span className="shrink-0 text-[15px] font-semibold">{value}</span>
      </div>
    </CardContent>
  )
}

type FooterProps = ComponentProps<typeof CardFooter>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <CardFooter
      className={cn('items-center justify-between px-0', className)}
      {...props}
    />
  )
}
