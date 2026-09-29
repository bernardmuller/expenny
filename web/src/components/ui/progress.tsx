import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const progressVariants = cva(
  'relative w-full overflow-hidden rounded-full h-4',
  {
    variants: {
      variant: {
        default:
          'bg-primary/20 [box-shadow:inset_0_3px_0_color-mix(in_srgb,var(--color-primary)_20%,transparent)]',
        destructive:
          'bg-destructive/25 [box-shadow:inset_0_3px_0_color-mix(in_srgb,var(--color-destructive)_25%,black)]',
        disabled:
          'bg-foreground/10 [box-shadow:inset_0_3px_0_color-mix(in_srgb,var(--color-foreground)_12%,transparent)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const progressIndicatorVariants = cva('h-full w-full flex-1 rounded-2xl', {
  variants: {
    variant: {
      default:
        'bg-primary [box-shadow:inset_0_3px_0_var(--progress-shine),0_2px_3px_color-mix(in_srgb,var(--color-primary)_50%,black)]',
      destructive:
        'bg-destructive [box-shadow:0_3px_3px_color-mix(in_srgb,var(--color-destructive)_50%,black)]',
      disabled:
        'bg-foreground/20 [box-shadow:inset_0_3px_0_var(--progress-shine-dim)]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

function Progress({
  className,
  variant,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> &
  VariantProps<typeof progressVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        progressVariants({ variant }),
        'transition-[color,box-shadow] motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(progressIndicatorVariants({ variant }))}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
