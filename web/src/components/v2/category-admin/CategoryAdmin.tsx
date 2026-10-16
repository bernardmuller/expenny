import { useSuspenseQuery } from '@tanstack/react-query'
import { FolderTree, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
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
import { Spinner } from '@/components/v2/ui/spinner'
import {
  getCategoryGroupsQueryOptions,
  getStatementCategoriesQueryOptions,
  useCreateCategory,
  useCreateCategoryGroup,
  useDeleteCategory,
  useDeleteCategoryGroup,
  useUpdateCategory,
  useUpdateCategoryGroup,
} from '@/lib/http/v2/queries/categories'
import type { CategoryGroupMutationInput } from '@/lib/http/v2/queries/categories'
import type {
  StatementCategory,
  StatementCategoryGroup,
} from '@/lib/http/v2/types'
import { cn } from '@/lib/utils/cn'

import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useCategoryColors } from '../shared/CategoryColors'
import { categoryTint } from '../shared/categories'
import { FormField } from '../shared/FormField'
import { PanelHeader } from '../shared/PanelHeader'

type CategoryDialogState =
  | { mode: 'create' }
  | { mode: 'edit'; category: StatementCategory }

type GroupDialogState =
  | { mode: 'create' }
  | { mode: 'edit'; group: StatementCategoryGroup }

type DeleteTarget =
  | { kind: 'category'; id: string; label: string }
  | { kind: 'group'; id: string; label: string }

export function CategoryAdmin({ className }: { className?: string }) {
  const categoriesQuery = useSuspenseQuery(getStatementCategoriesQueryOptions())
  const groupsQuery = useSuspenseQuery(getCategoryGroupsQueryOptions())

  const categories = categoriesQuery.data.categories
  const groups = groupsQuery.data.groups

  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const createGroup = useCreateCategoryGroup()
  const updateGroup = useUpdateCategoryGroup()
  const deleteGroup = useDeleteCategoryGroup()

  const [categoryDialog, setCategoryDialog] =
    useState<CategoryDialogState | null>(null)
  const [groupDialog, setGroupDialog] = useState<GroupDialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const toggleMembership = (
    category: StatementCategory,
    group: StatementCategoryGroup,
  ) => {
    const currentGroups = category.groups ?? []
    const active = currentGroups.some((candidate) => candidate.id === group.id)
    const groupIds = active
      ? currentGroups
          .filter((candidate) => candidate.id !== group.id)
          .map((candidate) => candidate.id)
      : [...currentGroups.map((candidate) => candidate.id), group.id]

    updateCategory.mutate({
      id: category.id,
      key: category.key,
      label: category.label,
      icon: category.icon,
      groupIds,
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const options = { onSuccess: () => setDeleteTarget(null) }
    if (deleteTarget.kind === 'category') {
      deleteCategory.mutate(deleteTarget.id, options)
    } else {
      deleteGroup.mutate(deleteTarget.id, options)
    }
  }

  return (
    <>
      <div className={cn(className)}>
        <div className="min-h-0 pr-1">
          <CategoriesPanel
            categories={categories}
            groups={groups}
            onCreate={() => setCategoryDialog({ mode: 'create' })}
            onEdit={(category) => setCategoryDialog({ mode: 'edit', category })}
            onDelete={(category) =>
              setDeleteTarget({
                kind: 'category',
                id: category.id,
                label: category.label,
              })
            }
            onToggleMembership={toggleMembership}
          />
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">
          <GroupsPanel
            groups={groups}
            onCreate={() => setGroupDialog({ mode: 'create' })}
            onEdit={(group) => setGroupDialog({ mode: 'edit', group })}
            onDelete={(group) =>
              setDeleteTarget({
                kind: 'group',
                id: group.id,
                label: group.label,
              })
            }
          />
        </div>
      </div>

      <GroupDialog
        state={groupDialog}
        isPending={createGroup.isPending || updateGroup.isPending}
        onOpenChange={(open) => {
          if (!open) setGroupDialog(null)
        }}
        onSubmit={(input) => {
          if (groupDialog?.mode === 'edit') {
            updateGroup.mutate(
              { id: groupDialog.group.id, ...input },
              { onSuccess: () => setGroupDialog(null) },
            )
            return
          }
          createGroup.mutate(input, { onSuccess: () => setGroupDialog(null) })
        }}
      />

      <CategoryDialog
        state={categoryDialog}
        isPending={createCategory.isPending || updateCategory.isPending}
        onOpenChange={(open) => {
          if (!open) setCategoryDialog(null)
        }}
        onSubmit={(input) => {
          if (categoryDialog?.mode === 'edit') {
            updateCategory.mutate(
              { id: categoryDialog.category.id, ...input },
              { onSuccess: () => setCategoryDialog(null) },
            )
            return
          }
          createCategory.mutate(input, {
            onSuccess: () => setCategoryDialog(null),
          })
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${
          deleteTarget?.kind === 'group' ? 'category group' : 'category'
        }?`}
        description={deleteDescription(deleteTarget)}
        isPending={deleteCategory.isPending || deleteGroup.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function deleteDescription(target: DeleteTarget | null) {
  if (!target) return ''
  if (target.kind === 'group') {
    return `"${target.label}" will be removed from every category that uses it. Transactions keep the group key on their existing classifications.`
  }
  return `"${target.label}" will be hidden from every picker. Existing transactions keep the category until they are reclassified.`
}

type GroupsPanelProps = {
  groups: Array<StatementCategoryGroup>
  onCreate: () => void
  onEdit: (group: StatementCategoryGroup) => void
  onDelete: (group: StatementCategoryGroup) => void
}

function GroupsPanel({ groups, onCreate, onEdit, onDelete }: GroupsPanelProps) {
  return (
    <Card className="border-border gap-4 px-5 py-5">
      <PanelHeader
        icon={<FolderTree className="size-4.5 text-[#f59e0b]" />}
        title="Category groups"
        description="Umbrellas a category can be tagged with."
        action={
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-4" />
            New
          </Button>
        }
      />
      <div className="divide-border divide-y">
        {groups.map((group) => (
          <div key={group.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{group.label}</p>
              <code className="text-muted-foreground text-xs">{group.key}</code>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={`Edit ${group.label}`}
              onClick={() => onEdit(group)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive size-9"
              aria-label={`Delete ${group.label}`}
              onClick={() => onDelete(group)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-muted-foreground py-3 text-sm">No groups yet.</p>
        )}
      </div>
    </Card>
  )
}

type CategoriesPanelProps = {
  categories: Array<StatementCategory>
  groups: Array<StatementCategoryGroup>
  onCreate: () => void
  onEdit: (category: StatementCategory) => void
  onDelete: (category: StatementCategory) => void
  onToggleMembership: (
    category: StatementCategory,
    group: StatementCategoryGroup,
  ) => void
}

function CategoriesPanel({
  categories,
  groups,
  onCreate,
  onEdit,
  onDelete,
  onToggleMembership,
}: CategoriesPanelProps) {
  const colors = useCategoryColors()

  return (
    <Card className="border-border h-full min-h-0 gap-4 px-5 py-5">
      <PanelHeader
        icon={<Tags className="size-4.5 text-[#f59e0b]" />}
        title="Categories"
        description="Click a group chip to add or remove the tag."
        action={
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-4" />
            New
          </Button>
        }
      />
      <div className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
        {categories.map((category) => {
          const tint = categoryTint(category.label, colors.get(category.label))

          return (
            <div
              key={category.id}
              className="flex flex-wrap items-start gap-3 py-3"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center
                  rounded-xl border text-xl"
                style={{
                  backgroundColor: tint.background,
                  borderColor: tint.border,
                  boxShadow: `0 3px 0 ${tint.lip}`,
                }}
              >
                {category.icon || '🏷️'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{category.label}</p>
                <code className="text-muted-foreground text-xs">
                  {category.key}
                </code>
              </div>

              <div
                className="flex basis-full flex-wrap gap-1.5 sm:ml-auto
                  sm:basis-auto"
              >
                {groups.map((group) => {
                  const assigned = category.groups ?? []
                  const active = assigned.some(
                    (candidate) => candidate.id === group.id,
                  )
                  return (
                    <button
                      key={group.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggleMembership(category, group)}
                      className={cn(
                        `focus-visible:ring-primary/40 rounded-full border
                        px-2.5 py-1 text-xs font-semibold transition-colors
                        outline-none focus-visible:ring-[3px]`,
                        active
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : `border-border bg-raised text-muted-foreground
                            hover:text-foreground`,
                      )}
                    >
                      {group.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Edit ${category.label}`}
                  onClick={() => onEdit(category)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive size-9"
                  aria-label={`Delete ${category.label}`}
                  onClick={() => onDelete(category)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          )
        })}
        {categories.length === 0 && (
          <p className="text-muted-foreground py-3 text-sm">
            No categories yet.
          </p>
        )}
      </div>
    </Card>
  )
}

type GroupDialogProps = {
  state: GroupDialogState | null
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CategoryGroupMutationInput) => void
}

function GroupDialog({
  state,
  isPending,
  onOpenChange,
  onSubmit,
}: GroupDialogProps) {
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')

  useEffect(() => {
    if (!state) return
    setLabel(state.mode === 'edit' ? state.group.label : '')
    setKey(state.mode === 'edit' ? state.group.key : '')
  }, [state])

  const valid = label.trim().length > 0 && key.trim().length > 0

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === 'edit' ? 'Edit group' : 'New group'}
          </DialogTitle>
          <DialogDescription>
            Groups are the umbrellas categories are tagged with, like Income or
            Expenses.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Label">
            <Input
              autoFocus
              value={label}
              placeholder="Eating out"
              onChange={(event) => setLabel(event.target.value)}
            />
          </FormField>
          <FormField
            label="Key"
            hint="Lowercase letters, numbers and dashes. Used by the classifier."
          >
            <Input
              value={key}
              placeholder="eating-out"
              onChange={(event) => setKey(event.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || isPending}
            onClick={() => onSubmit({ label: label.trim(), key: key.trim() })}
          >
            {isPending && <Spinner className="size-4" />}
            {state?.mode === 'edit' ? 'Save changes' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type CategoryDialogProps = {
  state: CategoryDialogState | null
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { key: string; label: string; icon: string }) => void
}

function CategoryDialog({
  state,
  isPending,
  onOpenChange,
  onSubmit,
}: CategoryDialogProps) {
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (!state) return
    setLabel(state.mode === 'edit' ? state.category.label : '')
    setKey(state.mode === 'edit' ? state.category.key : '')
    setIcon(state.mode === 'edit' ? state.category.icon : '')
  }, [state])

  const valid = label.trim().length > 0 && key.trim().length > 0

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === 'edit' ? 'Edit category' : 'New category'}
          </DialogTitle>
          <DialogDescription>
            Categories are what the classifier tags rows with. Group chips are
            managed from the list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Label">
            <Input
              autoFocus
              value={label}
              placeholder="Groceries"
              onChange={(event) => setLabel(event.target.value)}
            />
          </FormField>
          <FormField
            label="Key"
            hint="Lowercase letters, numbers and dashes. Used by the classifier."
          >
            <Input
              value={key}
              placeholder="groceries"
              onChange={(event) => setKey(event.target.value)}
            />
          </FormField>
          <FormField label="Icon" hint="A single emoji shown in the pickers.">
            <Input
              value={icon}
              placeholder="🛒"
              maxLength={10}
              onChange={(event) => setIcon(event.target.value)}
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
              onSubmit({
                label: label.trim(),
                key: key.trim(),
                icon: icon.trim(),
              })
            }
          >
            {isPending && <Spinner className="size-4" />}
            {state?.mode === 'edit' ? 'Save changes' : 'Create category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
