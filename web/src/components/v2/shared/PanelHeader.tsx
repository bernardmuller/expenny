import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

type PanelHeaderProps = {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

/** The title/description block every card in the dashboard opens with. */
export function PanelHeader({
  icon,
  title,
  description,
  action,
  className,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3',
        className,
      )}
    >
      <div>
        <h2
          className="font-display flex items-center gap-2 text-lg font-semibold"
        >
          {icon}
          {title}
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
      </div>
      {action}
    </div>
  )
}
