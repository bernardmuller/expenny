import { MoreVertical, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { RecentExpenseProps } from './RecentExpense.types'

export default function RecentExpense({
  description,
  amount,
  emoji,
  createdAt,
  onDelete,
}: RecentExpenseProps) {
  return (
    <div className="flex items-center justify-between py-2 pr-3 md:pr-0">
      <div className="flex items-center gap-3">
        <div
          className="bg-muted flex h-10 w-10 items-center justify-center
            rounded-2xl
            [box-shadow:var(--input-groove),inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <span className="text-lg drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">
            {emoji}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <div className="font-grotesk text-sm font-medium">
              {description}
            </div>
          </div>
          <div className="text-muted-foreground text-xs">{createdAt}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-md font-semibold">{amount}</div>
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${description}`}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* onSelect, not onClick: on touch devices the menu unmounts
                  before the click event lands, so onClick never fires. */}
              <DropdownMenuItem onSelect={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
