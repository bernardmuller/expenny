import { toast } from 'sonner'
import { withSession } from '../../with-token'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import type { paths } from '../../schema'
import type {
  StreakCell,
  StreakLevel,
  StreakWeek,
} from '@/components/streak-graph/StreakGraph.types'

export type StreakSuccess =
  paths['/streaks']['get']['responses']['200']['content']['application/json']

type StreakDay = StreakSuccess['days'][number]

type StreakError = {
  error: string
  message: string
  code: string
}

async function fetchUserStreak(days?: number): Promise<StreakSuccess> {
  const result = await withSession(
    () =>
      toResult(
        client.GET('/streaks', {
          params: { query: days ? { days } : undefined },
        }),
      ),
    (): StreakError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data,
    (error) => {
      toast.error(error.message || 'Failed to load your streak')
      throw error
    },
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n: number): string => String(n).padStart(2, '0')

const toDayString = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Maps a day's activity count to a 0–4 intensity level for the graph.
 * Swap this for an amount-based scale if the metric ever changes.
 */
export function getStreakLevel(count: number): StreakLevel {
  if (count <= 0) return 0
  if (count <= 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

/**
 * Turns the API's sparse day list into a GitHub-style grid: one column per
 * week (starting Sunday), seven rows per column, spanning the last `days`
 * calendar days up to today. Days outside the window are marked `inRange:false`
 * so the grid stays rectangular.
 */
export function transformStreakToWeeks(
  data: StreakSuccess,
  days = 365,
): StreakWeek[] {
  const counts = new Map(data.days.map((d) => [d.date, d.count]))

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const windowStart = new Date(today.getTime() - (days - 1) * DAY_MS)

  // Grid starts on the Sunday on/before the window start.
  const gridStart = new Date(windowStart)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const weeks: StreakWeek[] = []
  let cursor = new Date(gridStart)

  while (cursor <= today) {
    const cells: StreakCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = toDayString(cursor)
      const inRange = cursor >= windowStart && cursor <= today
      const count = inRange ? (counts.get(date) ?? 0) : 0
      cells.push({
        date,
        count,
        level: inRange ? getStreakLevel(count) : 0,
        inRange,
      })
      cursor = new Date(cursor.getTime() + DAY_MS)
    }
    weeks.push({ days: cells })
  }

  return weeks
}

export function getUserStreakQueryOptions(userId: string, days?: number) {
  return {
    queryKey: queryKeys.streak.byUser(userId),
    queryFn: () => fetchUserStreak(days),
  }
}
