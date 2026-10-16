import { Check } from 'lucide-react'
import { Fragment } from 'react'
import type { ReactNode } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/v2/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

import { groupCategoryOptions } from './categories'
import type { CategoryOption } from './Review.types'

type CategoryPickerProps = {
  /** The pill rendered inside the trigger. */
  trigger: ReactNode
  /** The merchant/description the picker belongs to, used for the a11y name. */
  label: string
  value: string
  groupKey?: string
  options: Array<CategoryOption>
  onChange?: (categoryId: string, groupKey: string) => void
  align?: 'start' | 'center' | 'end'
  className?: string
}

/**
 * A pill that opens a dropdown to recategorise a transaction. Shared by the
 * transactions table and the details panel so both offer the same picker.
 */
export function CategoryPicker({
  trigger,
  label,
  value,
  groupKey,
  options,
  onChange,
  align = 'start',
  className,
}: CategoryPickerProps) {
  const groups = groupCategoryOptions(options)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Change category for ${label}`}
          // Keep a surrounding row/panel from selecting when only the
          // category is being changed.
          onClick={(event) => event.stopPropagation()}
          className={cn(
            `focus-visible:ring-primary/40 cursor-pointer rounded-full
            transition-transform outline-none focus-visible:ring-[3px]
            active:translate-y-px`,
            className,
          )}
        >
          {trigger}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="max-h-80 w-52 overflow-y-auto"
        // Portal events still bubble through the React tree, so keep menu
        // interactions from reaching a row underneath.
        onClick={(event) => event.stopPropagation()}
      >
        {groups.map((group, index) => (
          <Fragment key={group.key}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel
                className="text-muted-foreground text-xs font-semibold
                  tracking-[0.06em] uppercase"
              >
                {group.label}
              </DropdownMenuLabel>
              {group.options.map((option) => {
                const selected =
                  option.value === value && option.groupKey === groupKey

                return (
                  <DropdownMenuItem
                    key={option.value}
                    disabled={selected}
                    onSelect={() =>
                      onChange?.(option.value, option.groupKey ?? '')
                    }
                  >
                    <Check className={cn('size-4', !selected && 'opacity-0')} />
                    {option.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
