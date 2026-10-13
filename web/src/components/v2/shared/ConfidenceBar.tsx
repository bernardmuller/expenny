import { cn } from '@/lib/utils/cn'

export type ConfidenceTone = 'positive' | 'warning'

export function getConfidenceTone(value: number): ConfidenceTone {
  return value >= 80 ? 'positive' : 'warning'
}

type ConfidenceBarProps = {
  value: number
  tone?: ConfidenceTone
  size?: 'sm' | 'md'
  className?: string
}

export function ConfidenceBar({
  value,
  tone,
  size = 'md',
  className,
}: ConfidenceBarProps) {
  const resolvedTone = tone ?? getConfidenceTone(value)
  const clamped = Math.min(Math.max(value, 0), 100)

  return (
    <span
      aria-hidden="true"
      data-slot="confidence-bar"
      className={cn(
        'bg-border h-1.5 shrink-0 overflow-hidden rounded-full',
        size === 'sm' ? 'w-10' : 'w-16',
        className,
      )}
    >
      <span
        data-slot="confidence-bar-indicator"
        className={cn(
          'block h-full rounded-full',
          resolvedTone === 'positive' ? 'bg-primary' : 'bg-chart-3',
        )}
        style={{ width: `${clamped}%` }}
      />
    </span>
  )
}

type ConfidenceStatProps = {
  value: number
  label?: string
  tone?: ConfidenceTone
  size?: 'sm' | 'md'
  className?: string
}

export function ConfidenceStat({
  value,
  label,
  tone,
  size = 'sm',
  className,
}: ConfidenceStatProps) {
  return (
    <div
      className={cn(
        'flex items-center',
        size === 'sm' ? 'gap-2' : 'gap-2.5',
        className,
      )}
    >
      <ConfidenceBar value={value} tone={tone} size={size} />
      <span
        className={cn(
          'text-card-foreground font-medium whitespace-nowrap',
          size === 'sm' ? 'text-[13px]' : 'text-sm',
        )}
      >
        {label ?? `${value}% sure`}
      </span>
    </div>
  )
}
