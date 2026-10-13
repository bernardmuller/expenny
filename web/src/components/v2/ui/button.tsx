import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-2 rounded-[18px] font-body text-sm
  font-bold whitespace-nowrap transition-all outline-none
  focus-visible:ring-[3px] focus-visible:ring-primary/40
  disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50
  disabled:shadow-none motion-reduce:transition-none
  [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground
          [box-shadow:0_5px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]
          hover:-translate-y-0.5 hover:brightness-[1.04]
          hover:[box-shadow:0_6px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]
          active:translate-y-1 active:[box-shadow:0_1px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]`,
        secondary: `border border-border bg-raised text-foreground
          [box-shadow:0_5px_0_var(--lip-sm)]
          hover:-translate-y-0.5 hover:bg-raised/80
          hover:[box-shadow:0_6px_0_var(--lip-sm)]
          active:translate-y-1 active:[box-shadow:0_1px_0_var(--lip-sm)]`,
        destructive: `bg-destructive text-white
          [box-shadow:0_5px_0_color-mix(in_srgb,var(--color-destructive)_65%,black)]
          hover:-translate-y-0.5
          active:translate-y-1
          active:[box-shadow:0_2px_0_color-mix(in_srgb,var(--color-destructive)_65%,black)]`,
        outline: `border border-border bg-raised text-card-foreground
          [box-shadow:0_3px_0_var(--lip-sm)]
          hover:-translate-y-0.5 hover:text-foreground
          active:translate-y-1 active:[box-shadow:0_1px_0_var(--lip-sm)]`,
        ghost: 'text-muted-foreground hover:bg-raised/60 hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 has-[>svg]:px-4',
        sm: 'h-9 gap-1.5 px-3.5 has-[>svg]:px-3',
        lg: 'h-14 px-7 text-base has-[>svg]:px-5',
        icon: 'size-11 rounded-[14px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
