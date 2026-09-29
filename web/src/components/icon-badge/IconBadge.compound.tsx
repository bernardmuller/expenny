import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

type RootProps = {
  children: ReactNode
  className?: string
  active?: boolean
}

export function Root({ children, className, active = false }: RootProps) {
  if (active) {
    return (
      <div
        className={cn(
          `animate-budget-press text-destructive-foreground bg-destructive flex
          items-center gap-1.5 rounded-full px-3 py-1.5
          [box-shadow:inset_0_3px_0_color-mix(in_srgb,white_35%,transparent),0_6px_0_color-mix(in_srgb,var(--color-destructive)_70%,var(--color-destructive))]
          hover:cursor-pointer motion-reduce:animate-none`,
          className,
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        `border-border bg-muted flex items-center gap-2 rounded-full border
        px-2.5 py-1.5
        [box-shadow:inset_0_2px_0_color-mix(in_srgb,white_38%,transparent),0_5px_0_color-mix(in_srgb,var(--color-muted)_78%,black)]
        transition-transform motion-reduce:transition-none`,
        className,
      )}
    >
      {children}
    </div>
  )
}

type IconProps = {
  children: ReactNode
  className?: string
}

export function Icon({ children, className }: IconProps) {
  return <div className={cn('h-3.5 w-3.5', className)}>{children}</div>
}
