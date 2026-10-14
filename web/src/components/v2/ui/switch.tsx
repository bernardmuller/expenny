import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils/cn'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        `peer focus-visible:ring-primary/40
        data-[state=checked]:border-primary/50 data-[state=checked]:bg-accent
        data-[state=unchecked]:border-border data-[state=unchecked]:bg-input
        inline-flex h-8.5 w-14 shrink-0 items-center rounded-full border
        transition-all outline-none focus-visible:ring-[3px]
        disabled:cursor-not-allowed disabled:opacity-50
        data-[state=checked]:[box-shadow:var(--input-groove)]
        data-[state=unchecked]:[box-shadow:var(--input-groove)]`,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          `data-[state=checked]:bg-primary
          data-[state=unchecked]:bg-muted-foreground pointer-events-none block
          size-6.5 rounded-full ring-0 transition-transform
          data-[state=checked]:translate-x-[25px]
          data-[state=checked]:[box-shadow:0_3px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]
          data-[state=unchecked]:translate-x-[3px]`,
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
