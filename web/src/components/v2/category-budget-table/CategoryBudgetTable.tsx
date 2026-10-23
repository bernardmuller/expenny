import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Fragment, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { Button } from '@/components/v2/ui/button'
import { Card } from '@/components/v2/ui/card'
import { Input } from '@/components/v2/ui/input'
import { Progress } from '@/components/v2/ui/progress'
import { Spinner } from '@/components/v2/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/v2/ui/table'
import type {
  CategoryBudgetCategory,
  CategoryBudgetGroup,
} from '@/lib/http/v2/types'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'

import { categoryTint } from '../shared/categories'
import { useCategoryColors } from '../shared/CategoryColors'
import { PanelHeader } from '../shared/PanelHeader'

export type CategoryBudgetTableProps = {
  groups: Array<CategoryBudgetGroup>
  isSavingBudget?: boolean
  onSetBudget: (category: CategoryBudgetCategory, amount: number) => void
  onDeleteBudget: (category: CategoryBudgetCategory) => void
  /** Rendered under a category row when it is expanded. */
  renderExpanded?: (categoryId: string, groupKey: string) => ReactNode
  className?: string
}

const headClassName =
  'text-muted-foreground h-9 px-3 text-xs font-semibold tracking-[0.06em] uppercase'

export function CategoryBudgetTable({
  groups,
  isSavingBudget,
  onSetBudget,
  onDeleteBudget,
  renderExpanded,
  className,
}: CategoryBudgetTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const colors = useCategoryColors()

  return (
    <Card
      className={cn(
        'min-h-0 flex-1 gap-0 overflow-hidden px-5 pt-5 pb-3',
        className,
      )}
    >
      <PanelHeader
        icon={<Wallet className="size-4.5 text-[#f472b6]" />}
        title="Budget"
        description="What you have allocated per category for the active period."
        className="pb-4"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(headClassName, 'w-8 pr-0 pl-3')} />
              <TableHead className={headClassName}>Category</TableHead>
              <TableHead className={cn(headClassName, 'w-32 text-right')}>
                Net spend
              </TableHead>
              <TableHead className={cn(headClassName, 'w-56')}>
                Budget
              </TableHead>
              <TableHead className={cn(headClassName, 'w-36')}>
                Progress
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.key}>
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={5}
                    className="bg-muted/50 text-muted-foreground px-3 py-2
                      text-xs font-semibold tracking-[0.06em] uppercase"
                  >
                    {group.label}
                  </TableCell>
                </TableRow>
                {group.categories.map((category) => {
                  const tint = categoryTint(
                    category.label,
                    colors.get(category.label),
                  )
                  // The same category can appear under more than one group
                  // when its transactions were split between them, so the
                  // expansion state includes the section.
                  const rowKey = `${group.key}:${category.id}`
                  const expanded = expandedId === rowKey
                  const allocated =
                    category.allocated !== null
                      ? Number.parseFloat(category.allocated)
                      : null
                  const spent = Number.parseFloat(category.spent)
                  const hasAllocation = allocated !== null && allocated > 0
                  const overBudget = hasAllocation && spent > allocated
                  const percentage = hasAllocation
                    ? Math.min(Math.max((spent / allocated) * 100, 0), 100)
                    : 0

                  return (
                    <Fragment key={category.id}>
                      <TableRow
                        data-state={expanded ? 'open' : undefined}
                        className="h-16 cursor-pointer"
                        onClick={() => setExpandedId(expanded ? null : rowKey)}
                      >
                        <TableCell className="pr-0 pl-3">
                          {expanded ? (
                            <ChevronDown
                              className="text-muted-foreground size-4"
                            />
                          ) : (
                            <ChevronRight
                              className="text-muted-foreground size-4"
                            />
                          )}
                        </TableCell>
                        <TableCell className="px-3">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="flex size-9.5 shrink-0 items-center
                                justify-center rounded-xl border text-lg"
                              style={{
                                backgroundColor: tint.background,
                                borderColor: tint.border,
                                boxShadow: `0 3px 0 ${tint.lip}`,
                              }}
                            >
                              {category.icon || '🏷️'}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold">
                                {category.label}
                              </p>
                              <p
                                className="text-muted-foreground truncate
                                  text-[11.5px]"
                              >
                                {category.key}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 text-right">
                          <span
                            className={cn(
                              `font-display text-base font-semibold
                              tabular-nums`,
                              spent < 0 && 'text-muted-foreground',
                              overBudget && 'text-destructive',
                            )}
                          >
                            {spent < 0 ? '-' : ''}
                            {formatCurrency(Math.abs(spent), 'za')}
                          </span>
                        </TableCell>
                        <TableCell className="px-3">
                          <BudgetCell
                            category={category}
                            allocated={allocated}
                            isSaving={isSavingBudget}
                            onSet={onSetBudget}
                            onDelete={onDeleteBudget}
                          />
                        </TableCell>
                        <TableCell className="px-3">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={percentage}
                              indicatorVariant={
                                overBudget ? 'destructive' : 'primary'
                              }
                              className="h-2.5 w-full"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={5}
                            className="bg-muted/30 p-0 align-top"
                          >
                            {renderExpanded
                              ? renderExpanded(category.id, category.group_key)
                              : null}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

function BudgetCell({
  category,
  allocated,
  isSaving,
  onSet,
  onDelete,
}: {
  category: CategoryBudgetCategory
  allocated: number | null
  isSaving?: boolean
  onSet: (category: CategoryBudgetCategory, amount: number) => void
  onDelete: (category: CategoryBudgetCategory) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const startEditing = () => {
    setValue(allocated !== null ? String(allocated) : '')
    setEditing(true)
  }

  const submit = () => {
    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed) || parsed < 0) return
    onSet(category, parsed)
    setEditing(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setEditing(false)
    }
  }

  return (
    // Keep clicks inside the budget cell from toggling the row expansion.
    <div
      className="flex items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {editing ? (
        <>
          <Input
            autoFocus
            type="number"
            min="0"
            step="50"
            inputMode="decimal"
            value={value}
            aria-label={`Budget for ${category.label}`}
            className="h-8 w-24 text-right"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="sm"
            disabled={isSaving || value.trim() === ''}
            onClick={submit}
          >
            {isSaving && <Spinner className="size-3.5" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span
            className={cn(
              'font-display text-base font-semibold',
              allocated === null && 'text-muted-foreground font-normal',
            )}
          >
            {allocated !== null ? formatCurrency(allocated, 'za') : 'No budget'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Set budget for ${category.label}`}
            onClick={startEditing}
          >
            {allocated !== null ? (
              <Pencil className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
          {category.category_budget_id && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive size-8"
              aria-label={`Remove budget for ${category.label}`}
              onClick={() => onDelete(category)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}
