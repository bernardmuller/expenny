import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  `inline-flex h-6.5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden
  rounded-full border px-2.5 text-[13px] font-semibold whitespace-nowrap font-body
  transition-[color,box-shadow] focus-visible:ring-[3px]
  focus-visible:ring-primary/40
  [&>svg]:pointer-events-none [&>svg]:size-3.5`,
  {
    variants: {
      variant: {
        default: `border-primary/50 bg-primary/16 text-primary
          [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-primary)_30%,transparent)]`,
        secondary: `border-border bg-raised text-card-foreground
          [box-shadow:0_2px_0_var(--lip-sm)]`,
        outline: `border-border bg-raised text-card-foreground`,
        gold: `border-chart-3/45 bg-chart-3/12 text-chart-3
          [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-chart-3)_55%,black)]`,
        destructive: `border-destructive/50 bg-destructive/15 text-destructive-foreground
          [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-destructive)_60%,black)]`,
        muted: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
