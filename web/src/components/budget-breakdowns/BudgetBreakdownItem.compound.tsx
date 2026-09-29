import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export function Root({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div
      className="bg-input/70 flex cursor-pointer flex-col gap-2 rounded-2xl p-5
        hover:bg-input/60
        [box-shadow:var(--card-shadow-sm)]"
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function Header({
  name,
  icon,
  children,
}: {
  name: string
  icon: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <h3 className="text-foreground font-grotesk text-md font-semibold">
          {name}
        </h3>
      </div>
      {children}
    </div>
  )
}

export function OverBudgetBadge() {
  return (
    <Badge
      variant="destructive"
      className="rounded-full px-2.5 py-1 font-semibold
        [box-shadow:inset_0_1px_0_color-mix(in_srgb,white_35%,transparent),0_2px_0_color-mix(in_srgb,var(--color-destructive)_70%,black)]
        hover:-translate-y-px transition-transform motion-reduce:transition-none"
    >
      Over budget
    </Badge>
  )
}

export function UnplannedBadge() {
  return (
    <Badge
      variant="outline"
      className="bg-muted rounded-full px-2.5 py-1 font-semibold
        [box-shadow:inset_0_1px_0_color-mix(in_srgb,white_38%,transparent),0_2px_0_color-mix(in_srgb,var(--color-muted)_78%,black)]
        hover:-translate-y-px border-border transition-transform motion-reduce:transition-none"
    >
      Unplanned
    </Badge>
  )
}

export function ProgressBar({ percentage }: { percentage: number }) {
  return <Progress variant="default" value={percentage} className="h-2" />
}

export function DisabledProgressBar() {
  return <Progress variant="disabled" className="h-2" />
}

export function OverBudgetProgressBar() {
  return <Progress variant="destructive" className="h-2" />
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 space-y-2">{children}</div>
}

export function Planned({ amount }: { amount: string }) {
  return (
    <div className="text-muted-foreground flex items-end gap-2">
      <span>Planned:</span>
      <span className="-mb-1 text-lg">{amount}</span>
    </div>
  )
}

export function Spent({ amount }: { amount: string }) {
  return (
    <div className="text-muted-foreground flex items-end gap-2 text-sm">
      <span>Spent:</span>
      <span className="text-primary font-grotesk -mb-1 text-lg tracking-wider">
        {amount}
      </span>
    </div>
  )
}

export function ReverseRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-row-reverse justify-between text-sm">
      {children}
    </div>
  )
}
