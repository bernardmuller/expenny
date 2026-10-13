import { AlertCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

import { ConfidenceStat } from '../shared/ConfidenceBar'

type RootProps = ComponentProps<typeof Card>

export function Root({ className, ...props }: RootProps) {
  return <Card variant="highlight" className={className} {...props} />
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

type TitleProps = {
  children: ReactNode
  className?: string
}

export function Title({ children, className }: TitleProps) {
  return (
    <CardTitle
      className={cn(
        'text-chart-3 flex items-center gap-1.5 text-sm font-semibold',
        className,
      )}
    >
      <AlertCircle className="size-4" />
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
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-5 rounded-full',
              i < current ? 'bg-chart-3' : 'bg-muted',
            )}
          />
        ))}
      </div>
      <span
        className="text-muted-foreground text-xs font-medium whitespace-nowrap"
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
  className?: string
}

export function Merchant({
  emoji,
  name,
  date,
  amount,
  className,
}: MerchantProps) {
  return (
    <CardContent className={cn('flex items-center gap-3', className)}>
      <div
        className="bg-muted flex size-12 shrink-0 items-center justify-center
          rounded-2xl text-xl [box-shadow:var(--input-groove)]"
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-grotesk truncate font-semibold">{name}</p>
        <p className="text-muted-foreground text-sm">{date}</p>
      </div>
      <span className="font-grotesk shrink-0 font-semibold">{amount}</span>
    </CardContent>
  )
}

type StatementProps = {
  children: ReactNode
  label?: string
  className?: string
}

export function Statement({
  children,
  label = 'On your statement',
  className,
}: StatementProps) {
  return (
    <CardContent className={cn('space-y-2', className)}>
      <p
        className="text-muted-foreground text-xs font-medium tracking-wide
          uppercase"
      >
        {label}
      </p>
      <div
        className="border-border bg-input/40 rounded-xl border px-3 py-2.5
          text-sm [box-shadow:var(--input-groove)]"
      >
        {children}
      </div>
    </CardContent>
  )
}

export function Classification({
  children,
  label = 'We think this is',
  className,
}: StatementProps) {
  return (
    <CardContent className={cn('space-y-2', className)}>
      <p
        className="text-muted-foreground text-xs font-medium tracking-wide
          uppercase"
      >
        {label}
      </p>
      <div className="flex items-center justify-between gap-3">{children}</div>
    </CardContent>
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
      className={cn(
        'gap-2 rounded-full px-3 py-2 text-sm font-semibold',
        className,
      )}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Badge>
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
    <CardContent className={cn('flex gap-3', className)}>
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
    <CardFooter className={cn('justify-between', className)}>
      {children}
    </CardFooter>
  )
}

type LinkActionProps = ComponentProps<typeof Button>

export function LinkAction({ className, ...props }: LinkActionProps) {
  return (
    <Button
      variant="link"
      className={cn('text-muted-foreground h-auto p-0 text-sm', className)}
      {...props}
    />
  )
}
