import { useSuspenseQuery } from '@tanstack/react-query'
import { History, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/v2/ui/button'
import { Card } from '@/components/v2/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/v2/ui/dialog'
import { Input } from '@/components/v2/ui/input'
import { SearchableSelect } from '@/components/v2/ui/searchable-select'
import { Spinner } from '@/components/v2/ui/spinner'
import {
  getCorrectionsQueryOptions,
  useCreateCorrection,
  useDeleteCorrection,
  useUpdateCorrection,
} from '@/lib/http/v2/queries/corrections'
import type { CorrectionWriteInput } from '@/lib/http/v2/queries/corrections'
import { getStatementCategoriesQueryOptions } from '@/lib/http/v2/queries/categories'
import type { Correction } from '@/lib/http/v2/types'
import { cn } from '@/lib/utils/cn'

import { CategoryPill } from '../classification-review/ReviewCard.compound'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { FormField } from '../shared/FormField'
import { PanelHeader } from '../shared/PanelHeader'

type CorrectionsAdminProps = {
  className?: string
}

type CorrectionDialogState =
  | { mode: 'create' }
  | { mode: 'edit'; correction: Correction }

/**
 * The classifier's memory, as a CRUD list. Every entry maps a normalised
 * merchant description to the category future transactions should get, so
 * deleting one only affects rows classified from then on.
 */
export function CorrectionsAdmin({ className }: CorrectionsAdminProps) {
  const correctionsQuery = useSuspenseQuery(getCorrectionsQueryOptions())
  const categoriesQuery = useSuspenseQuery(getStatementCategoriesQueryOptions())

  const createCorrection = useCreateCorrection()
  const updateCorrection = useUpdateCorrection()
  const deleteCorrection = useDeleteCorrection()

  const [dialog, setDialog] = useState<CorrectionDialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Correction | null>(null)

  const categoryOptions = [...categoriesQuery.data.categories]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((category) => ({
      value: category.id,
      label: `${category.icon} ${category.label}`.trim(),
    }))

  const corrections = correctionsQuery.data.corrections
  const isSaving = createCorrection.isPending || updateCorrection.isPending

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteCorrection.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  return (
    <>
      <Card className={cn('border-border min-h-0 gap-4 px-5 py-5', className)}>
        <PanelHeader
          icon={<History className="size-4.5 text-[#5bb5ff]" />}
          title="Corrections"
          description="Merchant wording the classifier remembers. Future transactions with the same description get the category you pick here."
          action={
            <Button size="sm" onClick={() => setDialog({ mode: 'create' })}>
              <Plus className="size-4" />
              New
            </Button>
          }
        />

        <div className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
          {corrections.map((correction) => (
            <div
              key={correction.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <span className="font-statement min-w-0 flex-1 truncate text-sm">
                {correction.description}
              </span>
              <CategoryPill
                icon={correction.category.icon}
                label={correction.category.label}
                className="shrink-0"
              />
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Edit ${correction.description}`}
                  onClick={() => setDialog({ mode: 'edit', correction })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive size-9"
                  aria-label={`Delete ${correction.description}`}
                  onClick={() => setDeleteTarget(correction)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {corrections.length === 0 && (
            <p className="text-muted-foreground py-3 text-sm">
              No corrections yet. Confirming a transaction in review adds one.
            </p>
          )}
        </div>
      </Card>

      <CorrectionDialog
        state={dialog}
        categoryOptions={categoryOptions}
        isPending={isSaving}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        onSubmit={(input) => {
          if (dialog?.mode === 'edit') {
            updateCorrection.mutate(
              { id: dialog.correction.id, ...input },
              { onSuccess: () => setDialog(null) },
            )
            return
          }
          createCorrection.mutate(input, { onSuccess: () => setDialog(null) })
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete correction?"
        description={
          deleteTarget
            ? `"${deleteTarget.description}" will be forgotten, so the classifier stops applying its category to new transactions. Rows already categorised are not changed.`
            : ''
        }
        isPending={deleteCorrection.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={confirmDelete}
      />
    </>
  )
}

type CorrectionDialogProps = {
  state: CorrectionDialogState | null
  categoryOptions: Array<{ label: string; value: string }>
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CorrectionWriteInput) => void
}

function CorrectionDialog({
  state,
  categoryOptions,
  isPending,
  onOpenChange,
  onSubmit,
}: CorrectionDialogProps) {
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    if (!state) return
    setDescription(state.mode === 'edit' ? state.correction.description : '')
    setCategoryId(state.mode === 'edit' ? state.correction.category.id : '')
  }, [state])

  const valid = description.trim().length > 0 && categoryId !== ''

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === 'edit' ? 'Edit correction' : 'New correction'}
          </DialogTitle>
          <DialogDescription>
            Transactions are matched on a normalised description, so card and
            reference numbers are stripped before comparing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField
            label="Description"
            hint="Merchant wording, e.g. Checkers Claremont."
          >
            <Input
              autoFocus
              value={description}
              placeholder="Checkers Claremont"
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <FormField label="Category">
            <SearchableSelect
              options={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Select category"
              isClearable={false}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || isPending}
            onClick={() =>
              onSubmit({ description: description.trim(), categoryId })
            }
          >
            {isPending && <Spinner className="size-4" />}
            {state?.mode === 'edit' ? 'Save changes' : 'Create correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
