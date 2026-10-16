import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CategoryDetailSkeleton() {
  return (
    <>
      <AppHeader.Root>
        <AppHeader.Left>
          <Skeleton className="h-8 w-8" />
        </AppHeader.Left>
        <AppHeader.Center>
          <Skeleton className="h-6 w-32" />
        </AppHeader.Center>
        <AppHeader.Right>
          <Skeleton className="h-8 w-8" />
        </AppHeader.Right>
      </AppHeader.Root>
      <Layout>
        {/* Category Chart Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>

        {/* Expenses List Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Layout>
    </>
  )
}
