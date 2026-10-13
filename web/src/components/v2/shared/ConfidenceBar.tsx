import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils/cn'

export type ConfidenceTone = 'positive' | 'warning'

export function getConfidenceTone(value: number): ConfidenceTone {
  return value >= 80 ? 'positive' : 'warning'
}

type ConfidenceBarProps = {
  value: number
  tone?: ConfidenceTone
  className?: string
}

export function ConfidenceBar({ value, tone, className }: ConfidenceBarProps) {
  const resolvedTone = tone ?? getConfidenceTone(value)
  const clamped = Math.min(Math.max(value, 0), 100)

  return (
    <Progress
      value={clamped}
      aria-valuenow={clamped}
      className={cn(
        'h-1.5 w-16',
        resolvedTone === 'warning' &&
          `bg-chart-3/20 [&_[data-slot=progress-indicator]]:bg-chart-3
          [&_[data-slot=progress-indicator]]:[box-shadow:none]`,
        className,
      )}
    />
  )
}

type ConfidenceStatProps = {
  value: number
  label?: string
  tone?: ConfidenceTone
  className?: string
}

export function ConfidenceStat({
  value,
  label,
  tone,
  className,
}: ConfidenceStatProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ConfidenceBar value={value} tone={tone} />
      <span className="text-muted-foreground text-sm">
        {label ?? `${value}% sure`}
      </span>
    </div>
  )
}
