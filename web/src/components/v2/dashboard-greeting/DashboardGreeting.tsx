import { Wallet } from 'lucide-react'

type DashboardGreetingProps = {
  userName: string
}

/** The brand mark plus the personal greeting shown at the top of the page. */
export function DashboardGreeting({ userName }: DashboardGreetingProps) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className="bg-primary text-primary-foreground mt-0.5 flex size-12
          shrink-0 -rotate-6 items-center justify-center rounded-2xl
          [box-shadow:0_4px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]"
      >
        <Wallet className="size-6" />
      </span>
      <div className="flex min-w-0 flex-col">
        <p
          className="font-display text-muted-foreground text-[19px] leading-none
            font-semibold tracking-[0.06em]"
        >
          Expenny
        </p>
        <h1
          className="font-display mt-2 text-[30px] leading-[1.08] font-semibold"
        >
          Hi, {userName}!
        </h1>
      </div>
    </div>
  )
}
