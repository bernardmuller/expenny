import { toast } from 'sonner'
import { Fragment, useState, useEffect } from 'react'
import z from 'zod'
import { Check, LoaderCircleIcon } from 'lucide-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { Category } from '@/lib/http/hooks/use-categories'
import AllocatableCategoryItem from '@/components/category-item/AllocatableCategoryItem'
import SelectableCategoryItem from '@/components/category-item/SelectableCategoryItem'
import OnboardingLayout from '@/components/onboarding/OnboardingLayout'
import Welcome from '@/components/onboarding/Welcome'
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
import { onboardingSteps } from '@/lib/constants/onboardingSteps'
import { useOnboardRequest } from '@/lib/http/hooks/use-onboard-request'
import { getActiveBudgetQueryOptions } from '@/lib/http/queries/budget'
import { getCategoriesQueryOptions } from '@/lib/http/queries/categories'
import { formatCurrency } from '@/lib/utils/formatting/formatCurrency'
import { getUserByIdQueryOptions } from '@/lib/http/queries/users/getUserById'
import {
  calculateNextBudgetStart,
  calculateBudgetEnd,
} from '@/lib/utils/budget-dates'
import { getDaysUntilStart } from '@/lib/utils/formatting/getDaysUntilStart'
import { BudgetStartIndicator } from '@/components/budget-start-indicator/BudgetStartIndicator'

const userCategorySchema = z.object({
  id: z.string(),
  icon: z.string(),
  label: z.string(),
  amount: z.number().positive('Amount must be greater than 0'),
})

const onboardingFormSchema = z
  .object({
    budgetFrequency: z.enum(['weekly', 'bi-weekly', 'monthly', 'custom']),
    budgetStartDay: z.number(),
    customDuration: z.number().optional(),
    name: z
      .string()
      .min(1, 'You must provide a budget name')
      .max(50, "Budget name can't exceed 50 characters"),
    startAmount: z.number().positive('You must provide a budget amount'),
    categories: z.array(userCategorySchema),
  })
  .refine((data) => data.startAmount > 0, {
    message: 'You must provide a budget amount',
    path: ['startAmount'],
  })
  .refine((data) => data.categories.length > 0, {
    message: 'You must select at least one category',
    path: ['categories'],
  })
  .refine(
    (data) => {
      if (data.budgetFrequency === 'monthly') {
        return data.budgetStartDay >= 1 && data.budgetStartDay <= 31
      }
      if (
        data.budgetFrequency === 'weekly' ||
        data.budgetFrequency === 'bi-weekly'
      ) {
        return data.budgetStartDay >= 0 && data.budgetStartDay <= 6
      }
      return true
    },
    {
      message: 'Invalid start day for selected frequency',
      path: ['budgetStartDay'],
    },
  )
  .refine(
    (data) => {
      if (data.budgetFrequency === 'custom') {
        return data.customDuration && data.customDuration > 0
      }
      return true
    },
    {
      message: 'You must provide a duration for custom frequency',
      path: ['customDuration'],
    },
  )

type OnboardingFormValues = z.infer<typeof onboardingFormSchema>

export const Route = createFileRoute('/archive/onboarding')({
  loader: async ({ context }) => {
    context.queryClient.prefetchQuery(getCategoriesQueryOptions())
  },
  component: OnboardingPage,
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
      <h3 className="text-lg">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}

const getStepWithError = (
  fieldMeta:
    | Partial<Record<string, { errors?: Array<unknown> } | undefined>>
    | undefined,
  formValues: OnboardingFormValues,
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
    return 4
  }

  return null
}

function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)

  const { data: categories } = useSuspenseQuery(getCategoriesQueryOptions())

  const onboardMutation = useOnboardRequest()

  const form = useAppForm({
    defaultValues: {
      budgetFrequency: 'monthly' as const,
      budgetStartDay: 1,
      customDuration: undefined,
      name: '',
      startAmount: 0,
      categories: [],
    } as OnboardingFormValues,
    validators: {
      onSubmit: onboardingFormSchema,
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
        value.budgetStartDay,
      )

      const endDate = calculateBudgetEnd(
        startDate,
        value.budgetFrequency,
        value.budgetStartDay,
        value.customDuration,
      )

      const onboardingData = {
        budgetFrequency: value.budgetFrequency,
        budgetStartDay: value.budgetStartDay,
        customDuration: value.customDuration,
        startDate,
        endDate,
        name: value.name,
        startAmount: value.startAmount,
        categories: transformedCategories,
      }

      console.log(onboardingData)

      onboardMutation.mutate(onboardingData, {
        onSuccess: async () => {
          await Promise.all([
            queryClient.prefetchQuery(getActiveBudgetQueryOptions()),
            queryClient.prefetchQuery(getCategoriesQueryOptions()),
            queryClient.invalidateQueries(getUserByIdQueryOptions()),
          ]).then(() => {
            navigate({ to: '/dashboard', state: { showConfetti: true } })
          })
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
            toast.error('Please complete your budget preferences')
            break
          case 2:
            toast.error('Please provide the budget name and start amount')
            break
          case 3:
            toast.error('Please select your spending categories')
            break
          case 4:
            toast.error('Please allocate amounts to all categories')
            break
        }
      }
    },
  })

  useEffect(() => {
    const frequency = form.state.values.budgetFrequency
    const currentDay = form.state.values.budgetStartDay

    if (frequency === 'monthly' && (currentDay < 1 || currentDay > 31)) {
      form.setFieldValue('budgetStartDay', 1)
    } else if (
      (frequency === 'weekly' || frequency === 'bi-weekly') &&
      (currentDay < 0 || currentDay > 6)
    ) {
      form.setFieldValue('budgetStartDay', 1)
    } else if (frequency === 'custom' && (!currentDay || currentDay < 1)) {
      form.setFieldValue('budgetStartDay', 30)
    }
  }, [form.state.values.budgetFrequency])

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

  if (currentStep === 0) {
    return (
      <OnboardingLayout>
        <Welcome onGetStarted={() => setCurrentStep(1)} />
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
          {onboardingSteps.map((step, index) => (
            <StepperItem
              key={index}
              step={index + 1}
              className="relative flex-1 items-start"
            >
              <StepperTrigger className="flex flex-col gap-2.5">
                <StepperIndicator>{index + 1}</StepperIndicator>
                <StepperTitle>{step.title}</StepperTitle>
              </StepperTrigger>
              {onboardingSteps.length > index + 1 && (
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
                    title="Preferences"
                    description={onboardingSteps[currentStep - 1].description}
                  />
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {/* <Separator />*/}
                  <form.AppField
                    name="budgetFrequency"
                    children={(field) => (
                      <field.BudgetFrequencyField
                        label="Budget Frequency"
                        placeholder="Select how often your budget resets"
                      />
                    )}
                  />
                  <form.Subscribe
                    selector={(state) => state.values.budgetFrequency}
                    children={(frequency) => (
                      <>
                        <form.AppField
                          name="budgetStartDay"
                          children={(field) => (
                            <field.BudgetStartDayField
                              label={
                                frequency === 'monthly'
                                  ? 'Start Day of Month'
                                  : frequency === 'weekly' ||
                                      frequency === 'bi-weekly'
                                    ? 'Start Day of Week'
                                    : 'Start Day'
                              }
                              placeholder={
                                frequency === 'monthly'
                                  ? 'Select day of month'
                                  : 'Select day of week'
                              }
                              frequency={frequency}
                            />
                          )}
                        />
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
                    )}
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
                        startDay,
                        customDuration,
                      )
                      return (
                        <BudgetStartIndicator
                          frequency={frequency}
                          daysUntilStart={daysUntilStart}
                          startDay={startDay}
                          customDuration={customDuration}
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
              <Card className="w-full">
                <CardHeader className="w-full">
                  <StepHeader
                    title="Setup your Budget"
                    description={onboardingSteps[currentStep - 1].description}
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
                  description={onboardingSteps[currentStep - 1].description}
                />
              </CardHeader>
              <CardContent>
                <div className="w-full space-y-4">
                  <form.AppField
                    name="categories"
                    children={(field) => (
                      <div className="flex flex-col">
                        {categories.categories.map((category, index) => {
                          const isChecked = field.state.value.some(
                            (cat) => cat.id === category.id,
                          )
                          return (
                            <Fragment key={category.id}>
                              <SelectableCategoryItem
                                {...category}
                                checked={isChecked}
                                onCheckedChange={() => toggleCategory(category)}
                              />
                              {index < categories.categories.length - 1 && (
                                <Separator className="my-2" />
                              )}
                            </Fragment>
                          )
                        })}
                      </div>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </StepperContent>
          <StepperContent
            value={4}
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
                            onboardingSteps[currentStep - 1].description
                          }
                        />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col gap-2">
                          <div
                            className="flex w-full items-center justify-between"
                          >
                            <h3 className="text-muted-foreground text-md">
                              Total Allocated
                            </h3>
                            <div className="flex gap-3">
                              <span className="text-md font-semibold">
                                {formatCurrency(totalAllocated, 'za')}
                              </span>
                              <span className="text-muted-foreground text-md">
                                of
                              </span>
                              <span className="text-md font-semibold">
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
                          {form.state.values.categories.map(
                            (category, index) => (
                              <Fragment key={category.id}>
                                <AllocatableCategoryItem
                                  id={category.id}
                                  icon={category.icon}
                                  label={category.label}
                                >
                                  <form.AppField
                                    name={`categories[${index}].amount`}
                                    children={(field) => (
                                      <div
                                        className="flex w-28 items-center gap-1"
                                      >
                                        <span className="text-md text-gray-400">
                                          R
                                        </span>
                                        <field.NumberField placeholder="0" />
                                      </div>
                                    )}
                                  />
                                </AllocatableCategoryItem>
                                {index <
                                  form.state.values.categories.length - 1 && (
                                  <Separator className="my-2" />
                                )}
                              </Fragment>
                            ),
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
          onClick={() => setCurrentStep((prev) => prev - 1)}
        >
          Previous
        </Button>
        {currentStep !== onboardingSteps.length ? (
          <Button
            onClick={() => setCurrentStep((prev) => prev + 1)}
            disabled={currentStep === onboardingSteps.length}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={() => form.handleSubmit()}
            disabled={form.state.isSubmitting || onboardMutation.isPending}
          >
            {(form.state.isSubmitting || onboardMutation.isPending) && (
              <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
            )}
            Finish
          </Button>
        )}
      </div>
    </OnboardingLayout>
  )
}
