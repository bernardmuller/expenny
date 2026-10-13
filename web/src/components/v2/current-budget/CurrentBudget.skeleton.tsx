import {
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import * as CurrentBudgetCompound from './CurrentBudget.compound'

export function CurrentBudgetSkeleton() {
  return (
    <CurrentBudgetCompound.Root>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <CardAction>
          <Skeleton className="h-8 w-28 rounded-full" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="mb-1 h-5 w-36" />
      </CardContent>
      <CardContent>
        <Skeleton className="h-3.5 w-full rounded-full" />
      </CardContent>
      <CardFooter className="items-end justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-16" />
      </CardFooter>
    </CurrentBudgetCompound.Root>
  )
}
