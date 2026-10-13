import * as React from 'react'

import { cn } from '@/lib/utils/cn'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        `border-input placeholder:text-muted-foreground
        focus-visible:border-ring focus-visible:ring-ring/40
        aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40
        aria-invalid:border-destructive dark:bg-input/40 flex
        field-sizing-content min-h-16 w-full rounded-2xl border bg-transparent
        px-4 py-2 text-base [box-shadow:var(--input-groove)]
        transition-[color,box-shadow] outline-none focus-visible:ring-[3px]
        focus-visible:[box-shadow:inset_0_2px_0_color-mix(in_srgb,var(--color-ring)_25%,transparent),inset_0_0_0_1px_var(--color-ring)]
        disabled:cursor-not-allowed disabled:opacity-50
        aria-invalid:[box-shadow:inset_0_2px_0_color-mix(in_srgb,var(--color-destructive)_25%,transparent),inset_0_0_0_1px_var(--color-destructive)]
        motion-reduce:transition-none md:text-sm`,
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
