import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/utils/cn'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        `bg-input border-border text-muted-foreground
        focus-visible:ring-primary/40 relative h-12 w-full min-w-22
        overflow-hidden rounded-full border
        [box-shadow:var(--input-groove),0_4px_0_var(--lip-sm)] transition-colors
        duration-300 outline-none focus-visible:ring-[3px]`,
        className,
      )}
    >
      <Sun
        aria-hidden="true"
        className={cn(
          `absolute top-1/2 left-4 size-4.5 -translate-y-1/2 transition-all
          duration-300 ease-out`,
          isDark ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0',
        )}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          `absolute top-1/2 right-4 size-4.5 -translate-y-1/2 transition-all
          duration-300 ease-out`,
          isDark ? 'rotate-0 opacity-0' : '-rotate-90 opacity-100',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          `bg-primary text-primary-foreground absolute top-[3px] flex h-10
          items-center justify-center rounded-full
          [box-shadow:0_3px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]
          transition-[left,right] duration-300 ease-out
          motion-reduce:transition-none`,
          isDark
            ? 'right-[3px] left-[calc(100%-43px)]'
            : 'right-[calc(100%-43px)] left-[3px]',
        )}
      >
        <span className="relative block size-4.5">
          <Sun
            className={cn(
              `absolute inset-0 size-4.5 transition-all duration-300 ease-out
              motion-reduce:transition-none`,
              isDark
                ? 'scale-0 -rotate-90 opacity-0'
                : 'scale-100 rotate-0 opacity-100',
            )}
          />
          <Moon
            className={cn(
              `absolute inset-0 size-4.5 transition-all duration-300 ease-out
              motion-reduce:transition-none`,
              isDark
                ? 'scale-100 rotate-0 opacity-100'
                : 'scale-0 rotate-90 opacity-0',
            )}
          />
        </span>
      </span>
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
