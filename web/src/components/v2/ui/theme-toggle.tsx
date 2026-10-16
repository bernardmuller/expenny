import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/components/providers/ThemeProvider'
import { Button } from '@/components/v2/ui/button'
import { cn } from '@/lib/utils/cn'

/**
 * Quiet icon button that flips the theme. It shows the mode it will switch
 * to, so the control stays out of the way until the user looks for it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn('size-12 shrink-0 rounded-full', className)}
    >
      {isDark ? (
        <Sun className="size-4.5" aria-hidden="true" />
      ) : (
        <Moon className="size-4.5" aria-hidden="true" />
      )}
    </Button>
  )
}
