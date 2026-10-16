import { Suspense } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { requireAuth } from '@/lib/auth/route-guard'
import {
  getNotificationPreferencesQueryOptions,
  type NotificationPreferenceWithEntity,
} from '@/lib/http/queries/notification-preferences/getNotificationPreferences'
import { useUpdateNotificationPreference } from '@/lib/http/hooks/use-update-notification-preference'
import { formatDayOfMonth } from '@/lib/utils/formatting/formatDayOfMonth'

const NOTIFICATION_LABELS: Record<
  string,
  { title: string; description: string }
> = {
  'activity-reminder': {
    title: 'Activity Reminder',
    description: 'Daily reminder to log your expenses',
  },
  'budget-end-reminder': {
    title: 'Budget End Reminder',
    description: 'Reminder to prep for upcoming budget end',
  },
}

const formatAmount = (amount: string) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(parseFloat(amount))

const formatDueDescription = (amount: string, scheduledAt: string) => {
  const day = parseInt(scheduledAt, 10)
  if (Number.isNaN(day)) return formatAmount(amount)
  return `${formatAmount(amount)} · Due on the ${formatDayOfMonth(day)}`
}

const fallbackLabel = (pref: NotificationPreferenceWithEntity) =>
  NOTIFICATION_LABELS[pref.type] ?? { title: pref.type, description: '' }

export const Route = createFileRoute('/archive/profile/notifications')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      getNotificationPreferencesQueryOptions(),
    )
  },
  component: NotificationsProfilePage,
})

function NotificationsProfilePage() {
  const router = useRouter()

  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <AppHeader.Back onBack={() => router.history.back()} />
        </AppHeader.Left>
        <AppHeader.Center>
          <AppHeader.Title>Notifications</AppHeader.Title>
        </AppHeader.Center>
        <AppHeader.Right>
          <ThemeToggle />
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <NotificationLists />
        </Suspense>
      </Layout>
    </>
  )
}

function NotificationLists() {
  const { data: preferences } = useSuspenseQuery(
    getNotificationPreferencesQueryOptions(),
  )
  const updateMutation = useUpdateNotificationPreference()

  const general = preferences.filter(
    (p) => p.type !== 'recurring-expense-reminder',
  )
  const recurring = preferences.filter(
    (p) => p.type === 'recurring-expense-reminder',
  )

  const onToggle = (id: string, checked: boolean) =>
    updateMutation.mutate({ id, body: { enabled: checked } })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>General Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          {general.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No notification preferences yet.
            </p>
          ) : (
            <div className="space-y-4">
              {general.map((pref) => (
                <PreferenceRow
                  key={pref.id}
                  pref={pref}
                  label={fallbackLabel(pref)}
                  isPending={updateMutation.isPending}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {recurring.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recurring Expense Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recurring.map((pref) => {
                const label = pref.template
                  ? {
                    title: pref.template.description,
                    description: formatDueDescription(
                      pref.template.amount,
                      pref.template.scheduledAt,
                    ),
                  }
                  : fallbackLabel(pref)
                return (
                  <PreferenceRow
                    key={pref.id}
                    pref={pref}
                    label={label}
                    isPending={updateMutation.isPending}
                    onToggle={onToggle}
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function PreferenceRow({
  pref,
  label,
  isPending,
  onToggle,
}: {
  pref: NotificationPreferenceWithEntity
  label: { title: string; description: string }
  isPending: boolean
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-foreground font-medium">{label.title}</p>
        {label.description ? (
          <p className="text-muted-foreground text-sm">{label.description}</p>
        ) : null}
      </div>
      <Switch
        checked={pref.enabled}
        disabled={isPending}
        onCheckedChange={(checked) => onToggle(pref.id, checked)}
      />
    </div>
  )
}
