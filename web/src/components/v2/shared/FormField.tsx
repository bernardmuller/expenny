import type { ReactNode } from 'react'

type FormFieldProps = {
  label: string
  hint?: string
  children: ReactNode
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span
        className="text-muted-foreground text-xs font-semibold tracking-[0.06em]
          uppercase"
      >
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground block text-xs">{hint}</span>
      )}
    </label>
  )
}
