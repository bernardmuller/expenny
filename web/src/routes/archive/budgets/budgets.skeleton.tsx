import { Layout } from '@/components/layouts/Layout'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function BudgetDetailSkeleton() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-2 h-8 w-32" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-border/50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-1 w-full" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
