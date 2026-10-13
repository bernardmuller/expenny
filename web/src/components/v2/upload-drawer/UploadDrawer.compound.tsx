import { Check, FileText, X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/v2/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/v2/ui/drawer'
import { Progress } from '@/components/v2/ui/progress'
import { Separator } from '@/components/v2/ui/separator'
import { Spinner } from '@/components/v2/ui/spinner'
import { cn } from '@/lib/utils/cn'

import { categoryTint } from '../shared/categories'
import type { UploadStepStatus } from './UploadDrawer.types'

type RootProps = ComponentProps<typeof Drawer>

export function Root({ children, ...props }: RootProps) {
  return <Drawer {...props}>{children}</Drawer>
}

export function Content({
  className,
  children,
  ...props
}: ComponentProps<typeof DrawerContent>) {
  return (
    <DrawerContent
      className={cn('mx-auto w-full max-w-lg', className)}
      {...props}
    >
      {children}
    </DrawerContent>
  )
}

export function Header({
  className,
  children,
  ...props
}: ComponentProps<typeof DrawerHeader>) {
  return (
    <DrawerHeader
      className={cn(
        'flex-row items-center justify-between gap-3 text-left',
        className,
      )}
      {...props}
    >
      {children}
    </DrawerHeader>
  )
}

type TitleProps = ComponentProps<typeof DrawerTitle>

export function Title({ className, ...props }: TitleProps) {
  return (
    <DrawerTitle
      className={cn('font-display text-2xl font-semibold', className)}
      {...props}
    />
  )
}

type DescriptionProps = ComponentProps<typeof DrawerDescription>

export function Description({ className, ...props }: DescriptionProps) {
  return <DrawerDescription className={cn('sr-only', className)} {...props} />
}

export function Close() {
  return (
    <DrawerClose asChild>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close"
        className="text-muted-foreground"
      >
        <X />
      </Button>
    </DrawerClose>
  )
}

type BodyProps = {
  children: ReactNode
  className?: string
}

export function Body({ children, className }: BodyProps) {
  return (
    <div className={cn('flex-1 space-y-5 overflow-y-auto px-4', className)}>
      {children}
    </div>
  )
}

type FileProps = {
  fileName: string
  fileRange: string
  className?: string
}

export function File({ fileName, fileRange, className }: FileProps) {
  return (
    <div
      className={cn(
        'border-border bg-muted flex items-center gap-4 rounded-2xl border p-4',
        className,
      )}
    >
      <div
        className="bg-raised text-card-foreground flex size-12 shrink-0
          items-center justify-center rounded-xl"
      >
        <FileText className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">{fileName}</p>
        <p className="text-muted-foreground text-sm">{fileRange}</p>
      </div>
    </div>
  )
}

type StepListProps = {
  children: ReactNode
  className?: string
}

export function StepList({ children, className }: StepListProps) {
  return <div className={cn('space-y-2', className)}>{children}</div>
}

function StepIcon({ status }: { status: UploadStepStatus }) {
  if (status === 'done') {
    return (
      <span
        className="bg-primary text-primary-foreground flex size-6 shrink-0
          items-center justify-center rounded-full
          [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]"
      >
        <Check className="size-3.5" />
      </span>
    )
  }

  if (status === 'active') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center">
        <Spinner className="text-primary size-5" />
      </span>
    )
  }

  return (
    <span className="border-muted/40 size-6 shrink-0 rounded-full border-2" />
  )
}

type StepProps = {
  status: UploadStepStatus
  title: string
  description: string
  count?: string
  progress?: number
  className?: string
}

export function Step({
  status,
  title,
  description,
  count,
  progress,
  className,
}: StepProps) {
  const muted = status === 'pending'

  return (
    <div className={cn('flex gap-3 py-2', className)}>
      <StepIcon status={status} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p
            className={cn(
              'font-body font-semibold',
              muted && 'text-muted-foreground',
            )}
          >
            {title}
          </p>
          {count && (
            <span className="text-foreground shrink-0 text-sm font-semibold">
              {count}
            </span>
          )}
        </div>
        {typeof progress === 'number' && (
          <Progress
            value={progress}
            aria-valuenow={progress}
            indicatorVariant="primary"
            className="h-3.5"
          />
        )}
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  )
}

type SortedProps = {
  children: ReactNode
  label?: string
  className?: string
}

export function Sorted({
  children,
  label = 'Sorted so far',
  className,
}: SortedProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <p
        className="text-muted-foreground text-xs font-semibold tracking-[0.06em]
          uppercase"
      >
        {label}
      </p>
      <Separator className="bg-border" />
      <div className="divide-border divide-y">{children}</div>
    </div>
  )
}

type SortedRowProps = {
  emoji: string
  name: string
  category: string
  className?: string
}

export function SortedRow({
  emoji,
  name,
  category,
  className,
}: SortedRowProps) {
  const tint = categoryTint(category)

  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <div
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-2xl
          border text-lg"
        style={{
          backgroundColor: tint.background,
          borderColor: tint.border,
          boxShadow: `0 3px 0 ${tint.lip}`,
        }}
      >
        {emoji}
      </div>
      <span className="flex-1 truncate font-semibold">{name}</span>
      <span
        className="inline-flex h-6.5 items-center rounded-full border px-2.5
          text-[13px] font-semibold"
        style={{
          color: tint.color,
          backgroundColor: tint.background,
          borderColor: tint.border,
        }}
      >
        {category}
      </span>
    </div>
  )
}

type FooterProps = {
  children: ReactNode
  className?: string
}

export function Footer({ children, className }: FooterProps) {
  return <DrawerFooter className={className}>{children}</DrawerFooter>
}
