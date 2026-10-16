import { Check, FileText, Upload, X } from 'lucide-react'
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
import { Textarea } from '@/components/v2/ui/textarea'
import { cn } from '@/lib/utils/cn'

import { categoryTint } from '../shared/categories'
import { useCategoryColor } from '../shared/CategoryColors'
import type { UploadStepStatus, UploadSummary } from './UploadDrawer.types'

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
      className={cn(
        `data-[vaul-drawer-direction=bottom]:mx-auto
        data-[vaul-drawer-direction=bottom]:w-full
        data-[vaul-drawer-direction=bottom]:max-w-lg
        data-[vaul-drawer-direction=right]:h-full
        data-[vaul-drawer-direction=right]:w-full
        data-[vaul-drawer-direction=right]:max-w-md
        data-[vaul-drawer-direction=right]:rounded-none
        data-[vaul-drawer-direction=right]:border-l
        data-[vaul-drawer-direction=right]:sm:max-w-md`,
        className,
      )}
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
            <span
              key={count}
              className="text-foreground animate-in fade-in
                slide-in-from-bottom-1 shrink-0 text-sm font-semibold
                duration-300"
            >
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
  const tint = categoryTint(category, useCategoryColor(category))

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

type StartProps = {
  value: string
  onPickFile?: () => void
  onChange?: (value: string) => void
  onSubmit?: () => void
  className?: string
}

/** The idle state: pick a CSV file or paste one in. */
export function Start({
  value,
  onPickFile,
  onChange,
  onSubmit,
  className,
}: StartProps) {
  return (
    <div className={cn('space-y-5', className)}>
      <button
        type="button"
        onClick={onPickFile}
        className="border-border bg-muted hover:border-primary/50
          focus-visible:ring-primary/40 flex w-full flex-col items-center
          gap-2.5 rounded-2xl border border-dashed p-6 text-center
          transition-colors outline-none focus-visible:ring-[3px]"
      >
        <span
          className="bg-raised text-card-foreground flex size-12 items-center
            justify-center rounded-xl"
        >
          <Upload className="size-5" />
        </span>
        <span className="font-display text-lg font-semibold">
          Choose a CSV file
        </span>
        <span className="text-muted-foreground text-sm">
          Use the statement export from your bank.
        </span>
      </button>
      <div className="flex items-center gap-3">
        <Separator className="bg-border flex-1" />
        <span
          className="text-muted-foreground text-xs font-semibold
            tracking-[0.06em] uppercase"
        >
          or paste it
        </span>
        <Separator className="bg-border flex-1" />
      </div>
      <Paste value={value} onChange={onChange} onSubmit={onSubmit} />
    </div>
  )
}

type PasteProps = {
  value: string
  onChange?: (value: string) => void
  onSubmit?: () => void
  className?: string
}

/** Text area for pasting a statement straight from the clipboard. */
export function Paste({ value, onChange, onSubmit, className }: PasteProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Textarea
        autoFocus
        spellCheck={false}
        value={value}
        aria-label="Statement CSV"
        placeholder={'Date,Description,Amount\n2026-10-01,Checkers,-452.90'}
        className="font-statement min-h-64 resize-y text-xs leading-relaxed"
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            onSubmit?.()
          }
        }}
      />
      <p className="text-muted-foreground text-sm">
        Paste the CSV from your bank, including the header row.
      </p>
    </div>
  )
}

type SuccessProps = {
  summary?: UploadSummary
  className?: string
}

/** The completed state: a big confirmation plus the counters. */
export function Success({ summary, className }: SuccessProps) {
  return (
    <div
      className={cn(
        `animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 py-6
        text-center duration-300`,
        className,
      )}
    >
      <span
        className="bg-primary text-primary-foreground flex size-16 shrink-0
          items-center justify-center rounded-full
          [box-shadow:0_5px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]"
      >
        <Check className="size-8" />
      </span>
      <div className="space-y-1">
        <p className="font-display text-xl font-semibold">
          All transactions imported
        </p>
        <p className="text-muted-foreground text-sm">
          {summary
            ? `${summary.processed} transaction${
                summary.processed === 1 ? '' : 's'
              } processed`
            : 'Your statement is ready to review.'}
        </p>
      </div>
      {summary && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <SummaryStat label="Categorised" value={summary.classified} />
          {summary.needsReview > 0 && (
            <SummaryStat label="To review" value={summary.needsReview} />
          )}
          {summary.failed > 0 && (
            <SummaryStat label="Failed" value={summary.failed} />
          )}
          {summary.parseSkipped > 0 && (
            <SummaryStat label="Skipped" value={summary.parseSkipped} />
          )}
        </div>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="border-border bg-muted flex items-baseline gap-2 rounded-full
        border px-4 py-2"
    >
      <span className="font-display text-lg font-semibold">{value}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  )
}
