import { Skeleton } from '@/components/v2/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div
      className="bg-background font-body text-foreground flex h-svh
        overflow-hidden"
    >
      <div className="border-border hidden w-64 shrink-0 border-r p-4 md:block">
        <Skeleton className="h-8 w-32" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-8 pt-8 pb-6">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div
            className="grid min-h-0 flex-1 items-stretch gap-5
              md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
          >
            <Skeleton className="h-full min-h-[320px] w-full rounded-2xl" />
            <Skeleton className="h-full min-h-[320px] w-full rounded-2xl" />
          </div>
        </div>
      </main>
    </div>
  )
}
