import { toast } from 'sonner'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import z from 'zod'
import { Check, LoaderCircleIcon, RefreshCw } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useStore } from '@tanstack/react-form'
import type { Category } from '@/lib/http/hooks/use-categories'
import AllocatableCategoryItem from '@/components/category-item/AllocatableCategoryItem'
import SelectableCategoryItem from '@/components/category-item/SelectableCategoryItem'
import OnboardingLayout from '@/components/onboarding/OnboardingLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
import { useAppForm } from '@/hooks/form'
import { useCategories } from '@/lib/http/hooks/use-categories'
import { useCreateBudget } from '@/lib/http/hooks/use-create-budget'
import { getActiveBudgetQueryOptions } from '@/lib/http/queries/budget'
import { getBudgetByIdQueryOptions } from '@/lib/http/queries/budget-detail'
import { getCategoriesQueryOptions } from '@/lib/http/queries/categories'
import { getUserCategoriesQueryOptions } from '@/lib/http/queries/users/getUserCatgories'
import { getUserPreferencesQueryOptions } from '@/lib/http/queries/users/getUserPreferences'
import { getUserRecurringExpensesQueryOptions } from '@/lib/http/queries/recurring-expenses/getUserRecurringExpenses'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { requireAuth } from '@/lib/auth/route-guard'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import BudgetInfoBlock from '@/components/budget-info/BudgetInfoBlock'
import CloseBudget from '@/components/close-budget/CloseBudget'
import RecurringExpenseSelectionStep from '@/components/recurring-expense-selection-step/RecurringExpenseSelectionStep'
import {
  calculateNextBudgetStart,
  calculateBudgetEnd,
} from '@/lib/utils/budget-dates'
import { getDaysUntilStart } from '@/lib/utils/formatting/getDaysUntilStart'
import { newBudgetSteps } from '@/lib/constants/newBudgetSteps'
import { BudgetStartIndicator } from '@/components/budget-start-indicator/BudgetStartIndicator'

const userCategorySchema = z.object({
  id: z.string(),
  icon: z.string(),
  label: z.string(),
  amount: z.number().positive('Amount must be greater than 0'),
})

const newBudgetFormSchema = z
  .object({
    budgetFrequency: z.enum(['weekly', 'bi-weekly', 'monthly', 'custom']),
    budgetStartDay: z.number().optional(),
    customDuration: z.number().nullish(),
    name: z
      .string()
      .min(1, 'You must provide a budget name')
      .max(50, "Budget name can't exceed 50 characters"),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    startAmount: z.number().positive('You must provide a budget amount'),
    categories: z.array(userCategorySchema),
    recurringExpenseTemplateIds: z.array(z.string().uuid()),
  })
  .refine((data) => data.startAmount > 0, {
    message: 'You must provide a budget amount',
    path: ['startAmount'],
  })
  .refine((data) => data.categories.length > 0, {
    message: 'You must select at least one category',
    path: ['categories'],
  })

type NewBudgetFormValues = z.infer<typeof newBudgetFormSchema>

export const Route = createFileRoute('/budgets/new')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    const activeBudget = await context.queryClient.ensureQueryData(
      getActiveBudgetQueryOptions(),
    )
    const userIdResult = getUserIdFromAccessToken()
    const prefetches: Array<Promise<unknown>> = [
      context.queryClient.ensureQueryData(getCategoriesQueryOptions()),
      context.queryClient.ensureQueryData(
        getBudgetByIdQueryOptions(activeBudget.id),
      ),
      context.queryClient.ensureQueryData(getUserCategoriesQueryOptions()),
      context.queryClient.ensureQueryData(getUserPreferencesQueryOptions()),
    ]
    if (userIdResult.isOk()) {
      prefetches.push(
        context.queryClient.ensureQueryData(
          getUserRecurringExpensesQueryOptions(userIdResult.value),
        ),
      )
    }
    await Promise.all(prefetches)
  },
  component: NewBudgetPage,
})

const StepHeader = ({
  title,
  description,
}: {
  title: string
  description: string
}) => {
  return (
    <div className="w-full">
      <h3 className="font-grotesk text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}

const getStepWithError = (
  fieldMeta:
    | Partial<Record<string, { errors?: Array<unknown> } | undefined>>
    | undefined,
  formValues: NewBudgetFormValues,
): number | null => {
  if (!fieldMeta) return null

  if (
    (fieldMeta['budgetFrequency']?.errors &&
      fieldMeta['budgetFrequency'].errors.length > 0) ||
    (fieldMeta['budgetStartDay']?.errors &&
      fieldMeta['budgetStartDay'].errors.length > 0) ||
    (fieldMeta['customDuration']?.errors &&
      fieldMeta['customDuration'].errors.length > 0)
  )
    return 1

  if (
    (fieldMeta['name']?.errors && fieldMeta['name'].errors.length > 0) ||
    (fieldMeta['startAmount']?.errors &&
      fieldMeta['startAmount'].errors.length > 0)
  )
    return 2

  if (
    fieldMeta['categories']?.errors &&
    fieldMeta['categories'].errors.length > 0 &&
    formValues.categories.length === 0
  )
    return 3

  if (
    fieldMeta['categories']?.errors &&
    fieldMeta['categories'].errors.length > 0 &&
    formValues.categories.length > 0
  ) {
    return 5
  }

  return null
}

function NewBudgetPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)

  const userIdResult = getUserIdFromAccessToken()
  const authedUserId = userIdResult.isOk() ? userIdResult.value : null

  const { data: currentBudget } = useSuspenseQuery(
    getActiveBudgetQueryOptions(),
  )
  const { data: budgetDetail } = useSuspenseQuery(
    getBudgetByIdQueryOptions(currentBudget.id),
  )
  const { data: preferences } = useSuspenseQuery(
    getUserPreferencesQueryOptions(),
  )
  const recurringQuery = useQuery({
    ...getUserRecurringExpensesQueryOptions(authedUserId ?? ''),
    enabled: !!authedUserId,
  })
  const recurringTemplatesData = recurringQuery.data ?? { templates: [] }
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategories()

  const createBudgetMutation = useCreateBudget()

  const currentAmount = parseFloat(currentBudget.currentAmount)
  const previousStartAmount = parseFloat(currentBudget.startAmount)
  const suggestedStartAmount = currentAmount + previousStartAmount

  const initialCategories = categories
    ? budgetDetail.budget.categoryBudgets
        .map((cb) => {
          const category = categories.categories.find(
            (c) => c.id === cb.categoryId,
          )
          return category
            ? {
                id: category.id,
                icon: category.icon,
                label: category.label,
                amount: parseFloat(cb.allocatedAmount),
              }
            : null
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
    : []

  const form = useAppForm({
    defaultValues: {
      budgetFrequency: preferences.frequency || 'monthly',
      budgetStartDay: preferences.budgetStartDate || 1,
      customDuration: preferences.customDuration,
      name: '',
      startAmount: Math.floor(suggestedStartAmount),
      categories: initialCategories,
      startDate: undefined,
      endDate: undefined,
      recurringExpenseTemplateIds: [],
    } as NewBudgetFormValues,
    validators: {
      onSubmit: newBudgetFormSchema,
    },
    onSubmit: ({ value }) => {
      const transformedCategories = value.categories.map((cat) => ({
        id: cat.id,
        icon: cat.icon,
        label: cat.label,
        amount: cat.amount || 0,
      }))

      const startDate = calculateNextBudgetStart(
        value.budgetFrequency,
        value.budgetStartDay ?? 1,
      )

      const endDate = calculateBudgetEnd(
        startDate,
        value.budgetFrequency,
        value.budgetStartDay ?? 1,
        value.customDuration ?? undefined,
      )

      const newBudgetData = {
        budgetFrequency: value.budgetFrequency,
        budgetStartDay: value.budgetStartDay,
        customDuration: value.customDuration,
        startDate,
        endDate,
        name: value.name,
        startAmount: value.startAmount,
        categories: transformedCategories,
        recurringExpenseTemplateIds: value.recurringExpenseTemplateIds,
      }

      createBudgetMutation.mutate(newBudgetData, {
        onSuccess: async (result) => {
          if (result.isOk()) {
            await queryClient.invalidateQueries({
              queryKey: ['budgets'],
            })
            navigate({ to: '/dashboard', state: { showConfetti: true } })
          }
        },
      })
    },
    onSubmitInvalid: ({ formApi }) => {
      const stepWithError = getStepWithError(
        formApi.state.fieldMeta,
        formApi.state.values,
      )
      if (stepWithError !== null) {
        setCurrentStep(stepWithError)
        switch (stepWithError) {
          case 1:
            toast.error('Please complete your budget time period')
            break
          case 2:
            toast.error('Please provide the budget name and start amount')
            break
          case 3:
            toast.error('Please select your spending categories')
            break
          case 4:
            toast.error('Please review your recurring expenses')
            break
          case 5:
            toast.error('Please allocate amounts to all categories')
            break
        }
      }
    },
  })

  const toggleCategory = (category: Category) => {
    const currentCategories = form.state.values.categories
    const isSelected = currentCategories.some((cat) => cat.id === category.id)

    if (isSelected) {
      form.setFieldValue(
        'categories',
        currentCategories.filter((cat) => cat.id !== category.id),
      )
    } else {
      form.setFieldValue('categories', [
        ...currentCategories,
        { ...category, amount: 0 },
      ])
    }
  }

  const selectedTemplateIdsKey = useStore(form.store, (s) =>
    s.values.recurringExpenseTemplateIds.slice().sort().join(','),
  )
  const selectedCategoryIdsKey = useStore(form.store, (s) =>
    s.values.categories
      .map((c) => c.id)
      .slice()
      .sort()
      .join(','),
  )

  const recurringByCategoryId = useMemo(() => {
    const map: Record<string, number> = {}
    const selectedSet = new Set(
      form.state.values.recurringExpenseTemplateIds,
    )
    for (const t of recurringTemplatesData.templates) {
      if (!selectedSet.has(t.id) || !t.categoryId) continue
      map[t.categoryId] = (map[t.categoryId] ?? 0) + parseFloat(t.amount)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateIdsKey, recurringTemplatesData.templates])

  const previousAmountByCategoryId = useMemo(() => {
    const map: Record<string, number | undefined> = {}
    for (const cb of budgetDetail.budget.categoryBudgets) {
      map[cb.categoryId] = parseFloat(cb.allocatedAmount)
    }
    return map
  }, [budgetDetail])

  const autoAmountByCategoryRef = useRef<Record<string, number | undefined>>({})
  const manuallyEditedCategoryIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const current = form.state.values.categories
    let changed = false
    const next = current.map((cat) => {
      const recurring = recurringByCategoryId[cat.id] ?? 0
      const lastAutoAmount = autoAmountByCategoryRef.current[cat.id]
      if (lastAutoAmount !== undefined && cat.amount !== lastAutoAmount) {
        manuallyEditedCategoryIds.current.add(cat.id)
      }
      if (manuallyEditedCategoryIds.current.has(cat.id)) return cat

      const target =
        recurring > 0 ? recurring : (previousAmountByCategoryId[cat.id] ?? 0)
      if (cat.amount !== target) {
        changed = true
        return { ...cat, amount: target }
      }
      return cat
    })
    if (changed) form.setFieldValue('categories', next)
    autoAmountByCategoryRef.current = Object.fromEntries(
      next.map((cat) => [cat.id, cat.amount]),
    )
    manuallyEditedCategoryIds.current = new Set(
      next
        .map((cat) => cat.id)
        .filter((id) => manuallyEditedCategoryIds.current.has(id)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recurringByCategoryId,
    selectedCategoryIdsKey,
    previousAmountByCategoryId,
  ])

  const prevSelectedCategoryIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentCategoryIds = new Set(
      form.state.values.categories.map((c) => c.id),
    )
    const added: string[] = []
    const removed: string[] = []
    currentCategoryIds.forEach((id) => {
      if (!prevSelectedCategoryIds.current.has(id)) added.push(id)
    })
    prevSelectedCategoryIds.current.forEach((id) => {
      if (!currentCategoryIds.has(id)) removed.push(id)
    })

    if (added.length === 0 && removed.length === 0) {
      prevSelectedCategoryIds.current = currentCategoryIds
      return
    }

    const addedSet = new Set(added)
    const removedSet = new Set(removed)
    const templatesToAdd = recurringTemplatesData.templates
      .filter((t) => t.categoryId && addedSet.has(t.categoryId))
      .map((t) => t.id)
    const templatesToRemoveSet = new Set(
      recurringTemplatesData.templates
        .filter((t) => t.categoryId && removedSet.has(t.categoryId))
        .map((t) => t.id),
    )

    const currentIds = form.state.values.recurringExpenseTemplateIds
    const next = Array.from(
      new Set([
        ...currentIds.filter((id) => !templatesToRemoveSet.has(id)),
        ...templatesToAdd,
      ]),
    )
    const changed =
      next.length !== currentIds.length ||
      next.some((id, i) => id !== currentIds[i])
    if (changed) form.setFieldValue('recurringExpenseTemplateIds', next)

    prevSelectedCategoryIds.current = currentCategoryIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryIdsKey, recurringTemplatesData.templates])

  if (currentStep === 0) {
    return (
      <OnboardingLayout>
        <CloseBudget onGetStarted={() => setCurrentStep(1)} />
      </OnboardingLayout>
    )
  }

  return (
    <OnboardingLayout>
      <Stepper
        value={currentStep}
        onValueChange={setCurrentStep}
        indicators={{
          completed: <Check className="size-4" />,
          loading: <LoaderCircleIcon className="size-4 animate-spin" />,
        }}
        className="flex flex-1 flex-col space-y-8"
      >
        <StepperNav>
          {newBudgetSteps.map((step, index) => (
            <StepperItem
              key={index}
              step={index + 1}
              className="relative flex-1 items-start"
            >
              <StepperTrigger className="flex flex-col gap-2.5">
                <StepperIndicator>{index + 1}</StepperIndicator>
                <StepperTitle>{step.title}</StepperTitle>
              </StepperTrigger>
              {newBudgetSteps.length > index + 1 && (
                <StepperSeparator
                  className="group-data-[state=completed]/step:bg-primary
                    absolute inset-x-0 top-3 left-[calc(50%+0.875rem)] m-0
                    group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)]
                    group-data-[orientation=horizontal]/stepper-nav:flex-none"
                />
              )}
            </StepperItem>
          ))}
        </StepperNav>
        <StepperPanel className="min-h-0 flex-1 overflow-y-auto text-sm">
          <StepperContent
            value={1}
            className="flex flex-1 items-center justify-center"
          >
            <FieldGroup>
              <Card className="w-full">
                <CardHeader className="w-full">
                  <StepHeader
                    title="Time period"
                    description={newBudgetSteps[currentStep - 1].description}
                  />
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <form.AppField
                    name="budgetFrequency"
                    children={(field) => (
                      <field.BudgetFrequencyField
                        label="Time Period"
                        placeholder="Select your budget time period"
                      />
                    )}
                  />
                  <form.Subscribe
                    selector={(state) => state.values.budgetFrequency}
                    children={(frequency) => {
                      const currentDay = form.state.values.budgetStartDay
                      if (
                        frequency === 'monthly' &&
                        currentDay !== undefined &&
                        (currentDay < 1 || currentDay > 31)
                      ) {
                        form.setFieldValue('budgetStartDay', 1)
                      } else if (
                        (frequency === 'weekly' || frequency === 'bi-weekly') &&
                        currentDay !== undefined &&
                        (currentDay < 0 || currentDay > 6)
                      ) {
                        form.setFieldValue('budgetStartDay', 1)
                      }
                      return (
                        <>
                          {frequency !== 'custom' && (
                            <form.AppField
                              name="budgetStartDay"
                              children={(field) => (
                                <field.BudgetStartDayField
                                  label="Start Day"
                                  placeholder={
                                    frequency === 'monthly'
                                      ? 'Select day of month'
                                      : 'Select day of week'
                                  }
                                  frequency={frequency}
                                />
                              )}
                            />
                          )}
                          {frequency === 'custom' && (
                            <form.AppField
                              name="customDuration"
                              children={(field) => (
                                <field.BudgetStartDayField
                                  label="Budget Duration (days)"
                                  placeholder="Enter number of days"
                                  frequency={frequency}
                                />
                              )}
                            />
                          )}
                        </>
                      )
                    }}
                  />
                  <form.Subscribe
                    selector={(state) => ({
                      frequency: state.values.budgetFrequency,
                      startDay: state.values.budgetStartDay,
                      customDuration: state.values.customDuration,
                    })}
                    children={({ frequency, startDay, customDuration }) => {
                      const daysUntilStart = getDaysUntilStart(
                        frequency,
                        startDay ?? 1,
                        customDuration ?? undefined,
                      )
                      return (
                        <BudgetStartIndicator
                          frequency={frequency}
                          daysUntilStart={daysUntilStart}
                          startDay={startDay ?? 1}
                          customDuration={customDuration ?? undefined}
                        />
                      )
                    }}
                  />
                </CardContent>
              </Card>
            </FieldGroup>
          </StepperContent>
          <StepperContent
            value={2}
            className="flex flex-1 items-center justify-center"
          >
            <FieldGroup>
              <div className="flex w-full flex-col gap-4">
                <BudgetInfoBlock
                  currentAmount={currentAmount}
                  previousStartAmount={previousStartAmount}
                  suggestedStartAmount={suggestedStartAmount}
                  budgetName={currentBudget.name}
                />
                <Card className="w-full">
                  <CardHeader className="w-full">
                    <StepHeader
                      title="Setup your New Budget"
                      description={newBudgetSteps[currentStep - 1].description}
                    />
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    <form.AppField
                      name="name"
                      children={(field) => (
                        <field.TextField
                          label="Budget name"
                          placeholder="eg. Monthly Budget"
                        />
                      )}
                    />
                    <form.AppField
                      name="startAmount"
                      children={(field) => (
                        <field.NumberField
                          label="Start Amount"
                          placeholder="eg. 10 000"
                        />
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </FieldGroup>
          </StepperContent>
          <StepperContent
            value={3}
            className="flex flex-1 items-center justify-center"
          >
            <Card className="w-full">
              <CardHeader>
                <StepHeader
                  title="Select Your Categories"
                  description={newBudgetSteps[currentStep - 1].description}
                />
              </CardHeader>
              <CardContent>
                <div className="w-full space-y-4">
                  {categoriesLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <LoaderCircleIcon className="h-8 w-8 animate-spin" />
                    </div>
                  ) : categoriesError ? (
                    <div className="text-destructive p-8 text-center">
                      Failed to load categories. Please try again.
                    </div>
                  ) : !categories || categories.categories.length === 0 ? (
                    <div className="text-muted-foreground p-8 text-center">
                      No categories available
                    </div>
                  ) : (
                    <form.AppField
                      name="categories"
                      children={(field) => {
                        const sortedCategories = [
                          ...categories.categories,
                        ].sort((a, b) => a.label.localeCompare(b.label))
                        return (
                          <div className="flex flex-col">
                            {sortedCategories.map((category, index) => {
                              const isChecked = field.state.value.some(
                                (cat) => cat.id === category.id,
                              )
                              return (
                                <Fragment key={category.id}>
                                  <SelectableCategoryItem
                                    {...category}
                                    checked={isChecked}
                                    onCheckedChange={() =>
                                      toggleCategory(category)
                                    }
                                  />
                                  {index < sortedCategories.length - 1 && (
                                    <Separator className="my-3" />
                                  )}
                                </Fragment>
                              )
                            })}
                          </div>
                        )
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </StepperContent>
          <StepperContent
            value={4}
            className="flex flex-1 items-center justify-center"
          >
            <Card className="w-full">
              <CardHeader>
                <StepHeader
                  title="Select Recurring Expenses"
                  description={newBudgetSteps[currentStep - 1].description}
                />
              </CardHeader>
              <CardContent>
                {authedUserId ? (
                  <form.Subscribe
                    selector={(state) => ({
                      cats: state.values.categories,
                      ids: state.values.recurringExpenseTemplateIds,
                    })}
                    children={({ cats, ids }) => (
                      <RecurringExpenseSelectionStep
                        userId={authedUserId}
                        selectedCategories={cats}
                        selectedTemplateIds={ids}
                        onTemplateToggle={(templateId, checked) => {
                          const current =
                            form.state.values.recurringExpenseTemplateIds
                          form.setFieldValue(
                            'recurringExpenseTemplateIds',
                            checked
                              ? Array.from(new Set([...current, templateId]))
                              : current.filter((id) => id !== templateId),
                          )
                        }}
                        onAddCategory={(category) => {
                          const exists = form.state.values.categories.some(
                            (c) => c.id === category.id,
                          )
                          if (exists) return
                          form.setFieldValue('categories', [
                            ...form.state.values.categories,
                            { ...category, amount: 0 },
                          ])
                        }}
                      />
                    )}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Unable to load your recurring expenses.
                  </p>
                )}
              </CardContent>
            </Card>
          </StepperContent>
          <StepperContent
            value={5}
            className="flex flex-1 flex-col items-center justify-center
              space-y-4"
          >
            <div className="w-full max-w-2xl space-y-4">
              <form.Subscribe
                selector={(state) => state.values.categories}
                children={(cs) => {
                  const totalAllocated = cs.reduce(
                    (sum, category) => sum + (category.amount || 0),
                    0,
                  )
                  return (
                    <Card>
                      <CardHeader>
                        <StepHeader
                          title="Allocate Your Categories"
                          description={
                            newBudgetSteps[currentStep - 1].description
                          }
                        />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col gap-2">
                          <div
                            className="flex w-full items-center justify-between"
                          >
                            <h3 className="text-muted-foreground text-sm">
                              Total Allocated
                            </h3>
                            <div className="flex gap-2">
                              <span className="text-sm font-semibold">
                                {formatCurrency(totalAllocated, 'za')}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                of
                              </span>
                              <span className="text-sm font-semibold">
                                {formatCurrency(
                                  form.state.values.startAmount,
                                  'za',
                                )}
                              </span>
                            </div>
                          </div>
                          <Progress
                            value={
                              totalAllocated > form.state.values.startAmount
                                ? 100
                                : (totalAllocated /
                                    form.state.values.startAmount) *
                                  100
                            }
                          />
                        </div>
                        <div className="flex flex-col">
                          {form.state.values.categories
                            .map((category, originalIndex) => ({
                              category,
                              originalIndex,
                            }))
                            .sort((a, b) =>
                              a.category.label.localeCompare(b.category.label),
                            )
                            .map(
                              (
                                { category, originalIndex },
                                sortedIndex,
                                arr,
                              ) => {
                                const recurringTotal =
                                  recurringByCategoryId[category.id] ?? 0
                                return (
                                  <Fragment key={category.id}>
                                    <AllocatableCategoryItem
                                      id={category.id}
                                      icon={category.icon}
                                      label={category.label}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="inline-flex size-4
                                            shrink-0 items-center
                                            justify-center"
                                        >
                                          {recurringTotal > 0 && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span
                                                  className="text-muted-foreground
                                                    inline-flex"
                                                  aria-label="Allocation derived from recurring expenses"
                                                >
                                                  <RefreshCw className="size-4" />
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                {formatCurrency(
                                                  recurringTotal,
                                                  'za',
                                                )}{' '}
                                                from recurring expenses
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </span>
                                        <div
                                          className="flex w-28 items-center
                                            gap-1"
                                        >
                                          <span className="text-md text-gray-400">
                                            R
                                          </span>
                                          <form.AppField
                                            name={`categories[${originalIndex}].amount`}
                                            children={(field) => (
                                              <field.NumberField
                                                placeholder="0"
                                                min={recurringTotal}
                                              />
                                            )}
                                          />
                                        </div>
                                      </div>
                                    </AllocatableCategoryItem>
                                    {sortedIndex < arr.length - 1 && (
                                      <Separator className="my-3" />
                                    )}
                                  </Fragment>
                                )
                              },
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                }}
              />
            </div>
          </StepperContent>
        </StepperPanel>
      </Stepper>
      <div className="flex items-center justify-between gap-2.5 py-4">
        <Button
          variant="outline"
          onClick={() =>
            currentStep > 1
              ? setCurrentStep((prev) => prev - 1)
              : router.history.back()
          }
        >
          {currentStep > 1 ? 'Previous' : 'Cancel'}
        </Button>
        {currentStep !== newBudgetSteps.length ? (
          <Button
            onClick={() => setCurrentStep((prev) => prev + 1)}
            disabled={currentStep === newBudgetSteps.length}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={() => {
              form.handleSubmit()
            }}
            disabled={form.state.isSubmitting || createBudgetMutation.isPending}
          >
            {(form.state.isSubmitting || createBudgetMutation.isPending) && (
              <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
            )}
            Finish
          </Button>
        )}
      </div>
    </OnboardingLayout>
  )
}
