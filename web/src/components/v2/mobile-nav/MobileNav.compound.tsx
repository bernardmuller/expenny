import { ClipboardPaste, Upload, User, Wallet } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

import { tintFromColor } from '../shared/categories'
import type { MobileNavItem } from './MobileNav.types'

type HeaderProps = ComponentProps<'header'> & {
  userName: string
}

export function Header({ userName, className, ...props }: HeaderProps) {
  return (
    <header
      className={cn('flex items-center justify-between px-1 py-1', className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground flex size-12 shrink-0
            -rotate-6 items-center justify-center rounded-2xl
            [box-shadow:0_4px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]"
        >
          <Wallet className="size-6.5" />
        </span>
        <div>
          <div className="font-display text-[22px] leading-tight font-bold">
            Expenny
          </div>
          <div className="text-muted-foreground text-sm">Hi, {userName}!</div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Profile"
        className="border-border bg-raised text-card-foreground
          focus-visible:ring-primary/40 inline-flex size-12 shrink-0
          items-center justify-center rounded-2xl border
          [box-shadow:0_4px_0_var(--lip-sm)] outline-none
          focus-visible:ring-[3px]"
      >
        <User className="size-5" />
      </button>
    </header>
  )
}

type ItemProps = {
  item: MobileNavItem
  active?: boolean
  onClick?: () => void
}

export function Item({ item, active = false, onClick }: ItemProps) {
  const Icon = item.icon
  const tint = tintFromColor(item.accent)

  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        `focus-visible:ring-primary/40 relative flex size-16 shrink-0 flex-col
        items-center justify-center gap-0.5 rounded-[18px] border text-xs
        font-semibold transition-all outline-none focus-visible:ring-[3px]`,
        active
          ? `bg-accent border-primary/50 text-accent-foreground mb-2.5
            translate-y-[3px]`
          : `bg-raised border-border text-card-foreground mb-2.5
            [box-shadow:0_4px_0_var(--lip-sm)]`,
      )}
    >
      <Icon className="size-5.5" style={{ color: tint.color }} />
      {item.label}
      {item.badge != null && (
        <span
          className="bg-chart-3 absolute -top-2 -right-1 inline-flex h-5.5
            min-w-5.5 rotate-[8deg] items-center justify-center rounded-full
            px-1.5 text-xs font-bold text-[#1a1203]
            [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-chart-3)_55%,black)]"
        >
          {item.badge}
        </span>
      )}
    </button>
  )
}

type UploadActionProps = ComponentProps<'button'>

export function UploadAction({ className, ...props }: UploadActionProps) {
  return (
    <button
      type="button"
      aria-label="Upload CSV"
      className={cn(
        `bg-primary text-primary-foreground focus-visible:ring-primary/40
        mb-[22px] inline-flex size-17 shrink-0 -rotate-4 items-center
        justify-center rounded-[24px]
        [box-shadow:0_6px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]
        outline-none focus-visible:ring-[3px]`,
        className,
      )}
      {...props}
    >
      <Upload className="size-7.5" />
    </button>
  )
}

type BarProps = {
  items: Array<MobileNavItem>
  activeId: string
  onNavigate?: (id: string) => void
  onUpload?: () => void
  onPaste?: () => void
  className?: string
  children?: ReactNode
}

export function Bar({
  items,
  activeId,
  onNavigate,
  onUpload,
  onPaste,
  className,
  children,
}: BarProps) {
  const midpoint = Math.ceil(items.length / 2)
  const leading = items.slice(0, midpoint)
  const trailing = items.slice(midpoint)

  const renderItem = (item: MobileNavItem) => (
    <Item
      key={item.id}
      item={item}
      active={item.id === activeId}
      onClick={() => onNavigate?.(item.id)}
    />
  )

  return (
    <nav
      aria-label="Main"
      className={cn(
        `bg-card border-border fixed inset-x-3.5 bottom-3.5 z-40 flex h-21
        items-end justify-between rounded-[30px] border px-2
        [box-shadow:0_6px_0_var(--lip)]`,
        className,
      )}
    >
      {leading.map(renderItem)}
      {children ??
        (onUpload ? (
          <div className="relative mb-[22px]">
            <UploadAction onClick={onUpload} />
            {onPaste && (
              <button
                type="button"
                aria-label="Paste CSV"
                onClick={onPaste}
                className="bg-card text-card-foreground border-border
                  focus-visible:ring-primary/40 absolute -top-1 -left-1
                  inline-flex size-9 -rotate-4 items-center justify-center
                  rounded-full border [box-shadow:0_3px_0_var(--lip-sm)]
                  outline-none focus-visible:ring-[3px]"
              >
                <ClipboardPaste className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div aria-hidden="true" className="mb-[22px] size-17 shrink-0" />
        ))}
      {trailing.map(renderItem)}
    </nav>
  )
}
