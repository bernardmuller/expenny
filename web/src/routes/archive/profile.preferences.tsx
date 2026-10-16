import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAppForm } from '@/hooks/form'
import { requireAuth } from '@/lib/auth/route-guard'
import { getBudgetCycleDescription } from '@/lib/utils/budget-dates'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import z from 'zod'

import { getUserPreferencesQueryOptions } from '@/lib/http/queries/users/getUserPreferences'
import { useUpdateUserPreferences } from '@/lib/http/hooks/use-update-user-preferences'
import { useSuspenseQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/archive/profile/preferences')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getUserPreferencesQueryOptions())
  },
  component: BudgetPreferencesPage,
})

const preferencesSchema = z
  .object({
    budgetFrequency: z.enum(['weekly', 'bi-weekly', 'monthly', 'custom']),
    budgetStartDay: z.number(),
    customDuration: z.number().optional(),
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

type PreferencesFormValues = z.infer<typeof preferencesSchema>

function BudgetPreferencesPage() {
  const router = useRouter()
  const { data: preferences } = useSuspenseQuery(
    getUserPreferencesQueryOptions(),
  )
  const updatePreferencesMutation = useUpdateUserPreferences()

  const getInitialValues = (): PreferencesFormValues => {
    return {
      budgetFrequency: preferences.frequency || 'monthly',
      budgetStartDay: preferences.budgetStartDate
        ? preferences.budgetStartDate
        : 1,
      customDuration: preferences.customDuration || undefined,
    }
  }

  const form = useAppForm({
    defaultValues: getInitialValues(),
    validators: {
      onSubmit: preferencesSchema,
    },
    onSubmit: ({ value }) => {
      updatePreferencesMutation.mutate({
        frequency: value.budgetFrequency,
        budgetStartDate: value.budgetStartDay,
        customDuration: value.customDuration,
      })
    },
  })

  console.log(getInitialValues(), preferences)
  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back onBack={() => router.history.back()} />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>Budget Preferences</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        <FieldGroup>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Budget Cycle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
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
                const description = getBudgetCycleDescription(
                  frequency,
                  startDay,
                  customDuration,
                )
                return (
                  <p className="text-muted-foreground text-sm italic">
                    {description}
                  </p>
                )
              }}
            />

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => form.handleSubmit()}
                disabled={form.state.isSubmitting}
              >
                Save Changes
              </Button>
            </div>
            </CardContent>
          </Card>
        </FieldGroup>
      </Layout>
    </>
  )
}
