import { Fragment } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Link } from '@tanstack/react-router'
import { getUserRecurringExpensesQueryOptions } from '@/lib/http/queries/recurring-expenses/getUserRecurringExpenses'
import { getCategoriesQueryOptions } from '@/lib/http/queries/categories'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'

type SelectedCategory = {
  id: string
  icon: string
  label: string
}

interface Props {
  userId: string
  selectedCategories: SelectedCategory[]
  selectedTemplateIds: string[]
  onTemplateToggle: (templateId: string, checked: boolean) => void
  onAddCategory: (category: SelectedCategory) => void
}

export default function RecurringExpenseSelectionStep({
  userId,
  selectedCategories,
  selectedTemplateIds,
  onTemplateToggle,
  onAddCategory,
}: Props) {
  const { data: templatesResponse } = useSuspenseQuery(
    getUserRecurringExpensesQueryOptions(userId),
  )
  const { data: categoriesResponse } = useSuspenseQuery(
    getCategoriesQueryOptions(),
  )

  const templates = templatesResponse.templates
  const allCategoriesById = new Map(
    categoriesResponse.categories.map((c) => [c.id, c]),
  )
  const selectedCategoryIds = new Set(selectedCategories.map((c) => c.id))

  if (templates.length === 0) {
    return (
      <div className="space-y-3 py-4 text-center">
        <p className="text-muted-foreground text-sm">
          You don't have any recurring expenses yet.
        </p>
        <Button variant="outline" asChild>
          <Link to="/archive/profile/recurring-expenses">Add recurring expenses</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {templates.map((template, index) => {
        const category = template.categoryId
          ? allCategoriesById.get(template.categoryId)
          : undefined
        const categoryAvailable =
          template.categoryId !== null &&
          selectedCategoryIds.has(template.categoryId)
        const checked =
          categoryAvailable && selectedTemplateIds.includes(template.id)

        return (
          <Fragment key={template.id}>
            <div
              className={`flex items-start justify-between gap-3 py-3 ${
                categoryAvailable ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-1 items-start gap-3">
                <Checkbox
                  id={`recurring-${template.id}`}
                  className="mt-1"
                  checked={checked}
                  disabled={!categoryAvailable}
                  onCheckedChange={(value) =>
                    onTemplateToggle(template.id, value === true)
                  }
                />
                <label
                  htmlFor={`recurring-${template.id}`}
                  className={`flex flex-1 flex-col ${
                    categoryAvailable
                      ? 'cursor-pointer'
                      : 'cursor-not-allowed'
                  }`}
                >
                  <span className="text-foreground font-medium">
                    {template.description}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {formatCurrency(parseFloat(template.amount), 'za')}
                    {category
                      ? ` · ${category.icon} ${category.label}`
                      : ' · (deleted category)'}
                  </span>
                  {!categoryAvailable && category && (
                    <button
                      type="button"
                      className="text-primary mt-1 self-start text-sm
                        underline-offset-2 hover:underline"
                      onClick={() =>
                        onAddCategory({
                          id: category.id,
                          icon: category.icon,
                          label: category.label,
                        })
                      }
                    >
                      Add '{category.label}' category to enable
                    </button>
                  )}
                  {!categoryAvailable && !category && (
                    <span className="text-muted-foreground mt-1 text-xs italic">
                      Category was deleted — edit this template to choose a new
                      one.
                    </span>
                  )}
                </label>
              </div>
            </div>
            {index < templates.length - 1 && <Separator />}
          </Fragment>
        )
      })}
    </div>
  )
}
