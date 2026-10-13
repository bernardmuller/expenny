import { AlertCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/v2/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/v2/ui/card'
import { cn } from '@/lib/utils/cn'

import { categoryTint } from '../shared/categories'
import { ConfidenceStat } from '../shared/ConfidenceBar'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return (
    <Card
      variant="highlight"
      className={cn('gap-4 p-5', className)}
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
        'text-chart-3 flex items-center gap-2 text-base font-semibold',
        className,
      )}
    >
      <AlertCircle className="size-4.5" />
      {children}
    </CardTitle>
  )
}

type StepMeterProps = {
  total: number
  current: number
  className?: string
}

export function StepMeter({ total, current, className }: StepMeterProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2.5', className)}>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-5 rounded-[3px]',
              i < current ? 'bg-chart-3' : 'bg-border',
            )}
          />
        ))}
      </div>
      <span
        className="text-muted-foreground text-[13px] font-medium
          whitespace-nowrap"
      >
        {current} of {total}
      </span>
    </div>
  )
}

type MerchantProps = {
  emoji: string
  name: string
  date: string
  amount: string
  category?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Merchant({
  emoji,
  name,
  date,
  amount,
  category,
  size = 'sm',
  className,
}: MerchantProps) {
  const tint = categoryTint(category)
  const isMedium = size === 'md'

  return (
    <CardContent
      className={cn(
        'flex items-center px-0',
        isMedium ? 'gap-3.5' : 'gap-3',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center border',
          isMedium
            ? 'size-14 rounded-[18px] text-[26px]'
            : 'size-13 rounded-2xl text-2xl',
        )}
        style={{
          backgroundColor: tint.background,
          borderColor: tint.border,
          boxShadow: `0 4px 0 ${tint.lip}`,
        }}
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-display truncate leading-tight font-semibold',
            isMedium ? 'text-2xl' : 'text-[22px]',
          )}
        >
          {name}
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">{date}</p>
      </div>
      <span
        className={cn(
          'font-display shrink-0 font-semibold',
          isMedium ? 'text-2xl' : 'text-[22px]',
        )}
      >
        {amount}
      </span>
    </CardContent>
  )
}

type StatementProps = {
  children: ReactNode
  label?: string
  date?: string
  amount?: string
  merchant?: string
  category?: string
  className?: string
}

export function Statement({
  children,
  label = 'On your statement',
  date,
  amount,
  merchant,
  category,
  className,
}: StatementProps) {
  return (
    <CardContent className={cn('space-y-2 px-0', className)}>
      <p
        className="text-muted-foreground text-xs font-semibold tracking-[0.06em]
          uppercase"
      >
        {label}
      </p>
      <div className="mx-1">
        <div className="rotate-[-1.2deg]">
          <div
            className="font-statement rounded-t-md bg-[#f1ecde] px-4 pt-3.5
              pb-2.5 text-[12.5px] leading-[1.6] text-[#26241f]"
          >
            <div className="font-medium tracking-[0.04em]">{children}</div>
            {date && amount && (
              <div className="text-[#5b574b]">
                {date} · {amount}
              </div>
            )}
            {merchant && (
              <>
                <div className="my-2 border-t-2 border-dashed border-[#b9b29d]" />
                <div className="flex justify-between gap-3">
                  <span>→ {merchant}</span>
                  {category && <span>{category}</span>}
                </div>
              </>
            )}
          </div>
          <div
            aria-hidden="true"
            className="h-2"
            style={{
              background:
                'linear-gradient(135deg,#f1ecde 25%,transparent 25%) -4px 0, linear-gradient(225deg,#f1ecde 25%,transparent 25%) -4px 0',
              backgroundSize: '8px 8px',
            }}
          />
        </div>
      </div>
    </CardContent>
  )
}

type ClassificationProps = {
  children: ReactNode
  /** Optional eyebrow label, used by the desktop panel. */
  label?: string
  /** Lay the label and content out on a single row (desktop panel). */
  inline?: boolean
  className?: string
}

export function Classification({
  children,
  label,
  inline = false,
  className,
}: ClassificationProps) {
  return (
    <CardContent
      className={cn(
        inline ? 'flex items-center justify-between px-0' : 'px-0',
        className,
      )}
    >
      {label && (
        <p
          className="text-muted-foreground text-xs font-semibold
            tracking-[0.06em] uppercase"
        >
          {label}
        </p>
      )}
      <div
        className={cn(
          'flex items-center',
          inline ? 'shrink-0' : 'justify-between gap-3',
        )}
      >
        {children}
      </div>
    </CardContent>
  )
}

type CategoryPillProps = {
  icon: string
  label: string
  className?: string
}

export function CategoryPill({ icon, label, className }: CategoryPillProps) {
  const tint = categoryTint(label)

  return (
    <span
      data-slot="category-pill"
      className={cn(
        `inline-flex h-9 items-center gap-2 rounded-full border px-3.5
        text-[15px] font-semibold`,
        className,
      )}
      style={{
        color: tint.color,
        backgroundColor: tint.background,
        borderColor: tint.border,
      }}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  )
}

export function Confidence({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <ConfidenceStat
      value={value}
      tone="warning"
      size="md"
      className={className}
      label={`${value}% sure`}
    />
  )
}

type ActionsProps = {
  children: ReactNode
  className?: string
}

export function Actions({ children, className }: ActionsProps) {
  return (
    <CardContent className={cn('flex gap-2.5 px-0', className)}>
      {children}
    </CardContent>
  )
}

type FooterProps = {
  children: ReactNode
  className?: string
}

export function Footer({ children, className }: FooterProps) {
  return (
    <CardFooter className={cn('justify-between px-0', className)}>
      {children}
    </CardFooter>
  )
}

type LinkActionProps = ComponentProps<typeof Button>

export function LinkAction({ className, ...props }: LinkActionProps) {
  return (
    <Button
      variant="link"
      className={cn(
        `text-muted-foreground h-11 p-0 text-[15px] font-medium underline
        underline-offset-[3px] hover:no-underline`,
        className,
      )}
      {...props}
    />
  )
}
