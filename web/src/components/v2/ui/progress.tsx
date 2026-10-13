import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const progressVariants = cva(
  `relative h-8 w-full overflow-hidden rounded-full border border-border
  bg-muted p-[3px] [box-shadow:var(--input-groove),0_3px_0_var(--lip)]`,
  {
    variants: {
      variant: {
        default: '',
        disabled:
          'border-border bg-muted [box-shadow:var(--input-groove),0_3px_0_var(--lip)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const progressIndicatorVariants = cva(
  'relative h-full w-full flex-1 rounded-full',
  {
    variants: {
      variant: {
        default:
          'bg-[linear-gradient(90deg,#3fa876,#4cc38a_62%,#d8c04e)] [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]',
        primary:
          'bg-primary [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]',
        warning:
          'bg-chart-3 [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-chart-3)_55%,black)]',
        destructive:
          'bg-destructive [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-destructive)_60%,black)]',
        disabled: 'bg-foreground/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> &
  VariantProps<typeof progressVariants> & {
    /** Which indicator gradient to render. Defaults to the budget gradient. */
    indicatorVariant?: VariantProps<typeof progressIndicatorVariants>['variant']
    /** Render quarter tick marks over the track (25 / 50 / 75%). */
    showTicks?: boolean
  }

function Progress({
  className,
  variant,
  indicatorVariant,
  showTicks = false,
  value,
  ...props
}: ProgressProps) {
  const resolvedIndicator =
    indicatorVariant ?? (variant === 'disabled' ? 'disabled' : 'default')

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
        className={cn(
          progressIndicatorVariants({ variant: resolvedIndicator }),
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        {resolvedIndicator !== 'disabled' && (
          <span
            aria-hidden="true"
            data-slot="progress-shine"
            className="absolute top-[3px] right-3 left-3 h-[5px] rounded-full
              bg-white/28"
          />
        )}
      </ProgressPrimitive.Indicator>
      {showTicks && (
        <span
          aria-hidden="true"
          data-slot="progress-ticks"
          className="contents"
        >
          {[25, 50, 75].map((tick) => (
            <span
              key={tick}
              data-slot="progress-tick"
              className="absolute top-1.5 bottom-1.5 w-0.5 bg-black/28"
              style={{ left: `${tick}%` }}
            />
          ))}
        </span>
      )}
    </ProgressPrimitive.Root>
  )
}

export { Progress, progressVariants, progressIndicatorVariants }
export type { ProgressProps }
