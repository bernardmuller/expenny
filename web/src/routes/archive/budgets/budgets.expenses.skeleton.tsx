import { Layout } from '@/components/layouts/Layout'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function BudgetExpensesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-64" />
        </CardTitle>
        <CardAction>
          <Skeleton className="h-4 w-32" />
        </CardAction>
      </CardHeader>
      <CardContent className="divide-border divide-y">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
