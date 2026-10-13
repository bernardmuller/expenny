import { Upload, Wallet } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Avatar, AvatarFallback } from '@/components/v2/ui/avatar'
import { Button } from '@/components/v2/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '@/components/v2/ui/sidebar'
import { ThemeToggle } from '@/components/v2/ui/theme-toggle'
import { cn } from '@/lib/utils/cn'

import { fallbackCategoryColor, withAlpha } from '../shared/categories'

type ProviderProps = ComponentProps<typeof SidebarProvider>

export function Provider({ className, ...props }: ProviderProps) {
  return (
    <SidebarProvider
      className={cn('bg-background min-h-0 w-auto', className)}
      {...props}
    />
  )
}

type RootProps = ComponentProps<typeof Sidebar>

export function Root({ className, ...props }: RootProps) {
  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className={cn(
        `bg-background [&>[data-slot=sidebar-inner]]:border-border
        [&>[data-slot=sidebar-inner]]:bg-card
        [&>[data-slot=sidebar-inner]]:rounded-[28px]
        [&>[data-slot=sidebar-inner]]:shadow-[0_6px_0_var(--lip)]`,
        className,
      )}
      {...props}
    />
  )
}

export function Header({
  children,
  className,
  ...props
}: ComponentProps<typeof SidebarHeader>) {
  return (
    <SidebarHeader
      className={cn(
        `gap-[22px] px-3.5 pt-5 pb-[22px]
        group-data-[collapsible=icon]:items-center
        group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-4`,
        className,
      )}
      {...props}
    >
      {children}
    </SidebarHeader>
  )
}

type LogoProps = {
  name: string
  className?: string
}

export function Logo({ name, className }: LogoProps) {
  return (
    <div
      className={cn(
        `flex items-center gap-3 px-1.5
        group-data-[collapsible=icon]:justify-center
        group-data-[collapsible=icon]:px-0`,
        className,
      )}
    >
      <span
        className="bg-primary text-primary-foreground flex size-12 shrink-0
          -rotate-6 items-center justify-center rounded-2xl
          [box-shadow:0_4px_0_color-mix(in_srgb,var(--color-primary)_72%,black)]"
      >
        <Wallet className="size-6.5" />
      </span>
      <span
        className="font-display text-[25px] leading-none font-bold
          tracking-[0.2px] group-data-[collapsible=icon]:hidden"
      >
        {name}
      </span>
    </div>
  )
}

type UploadActionProps = ComponentProps<typeof Button>

export function UploadAction({ className, ...props }: UploadActionProps) {
  return (
    <Button
      size="lg"
      className={cn(
        `h-14 gap-2.5 rounded-[18px] text-base
        group-data-[collapsible=icon]:size-12 group-data-[collapsible=icon]:p-0`,
        className,
      )}
      {...props}
    >
      <Upload className="size-5" />
      <span className="group-data-[collapsible=icon]:hidden">Upload CSV</span>
    </Button>
  )
}

export function Content({
  className,
  ...props
}: ComponentProps<typeof SidebarContent>) {
  return (
    <SidebarContent
      className={cn(
        'gap-1.5 px-3.5 group-data-[collapsible=icon]:px-1',
        className,
      )}
      {...props}
    />
  )
}

export function Nav({
  className,
  ...props
}: ComponentProps<typeof SidebarMenu>) {
  return <SidebarMenu className={cn('gap-2.5', className)} {...props} />
}

export function NavItem({
  className,
  ...props
}: ComponentProps<typeof SidebarMenuItem>) {
  return <SidebarMenuItem className={className} {...props} />
}

export function NavButton({
  className,
  ...props
}: ComponentProps<typeof SidebarMenuButton>) {
  return (
    <SidebarMenuButton
      className={cn(
        `border-border bg-raised text-card-foreground hover:bg-raised
        hover:text-foreground data-[active=true]:border-primary/50
        data-[active=true]:bg-accent data-[active=true]:hover:bg-accent
        data-[active=true]:text-accent-foreground h-13 gap-3 rounded-2xl border
        px-2.5 text-[15px] font-semibold [box-shadow:0_4px_0_var(--lip-sm)]
        group-data-[collapsible=icon]:size-12!
        group-data-[collapsible=icon]:justify-center!
        group-data-[collapsible=icon]:p-0! data-[active=true]:mb-1
        data-[active=true]:translate-y-1 data-[active=true]:[box-shadow:none]`,
        className,
      )}
      {...props}
    />
  )
}

type NavIconProps = {
  accent?: string
  active?: boolean
  children: ReactNode
  className?: string
}

export function NavIcon({
  accent,
  active = false,
  children,
  className,
}: NavIconProps) {
  const color = accent ?? fallbackCategoryColor

  return (
    <span
      aria-hidden="true"
      data-slot="nav-icon"
      className={cn(
        `flex size-8 shrink-0 items-center justify-center rounded-[10px] border
        [&>svg]:size-[18px]`,
        className,
      )}
      style={{
        color,
        backgroundColor: withAlpha(color, active ? 0.2 : 0.16),
        borderColor: withAlpha(color, active ? 0.55 : 0.5),
        boxShadow: active ? undefined : `0 2px 0 ${withAlpha(color, 0.3)}`,
      }}
    >
      {children}
    </span>
  )
}

type NavBadgeProps = {
  children: ReactNode
  className?: string
}

export function NavBadge({ children, className }: NavBadgeProps) {
  return (
    <span
      className={cn(
        `bg-chart-3 ml-auto inline-flex h-6 min-w-6 rotate-[8deg] items-center
        justify-center rounded-full px-1.5 text-[13px] font-bold text-[#1a1203]
        [box-shadow:0_2px_0_color-mix(in_srgb,var(--color-chart-3)_55%,black)]
        group-data-[collapsible=icon]:hidden`,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Footer({
  className,
  ...props
}: ComponentProps<typeof SidebarFooter>) {
  return (
    <SidebarFooter
      className={cn(
        `gap-3 px-3.5 pt-0 pb-[18px] group-data-[collapsible=icon]:items-center
        group-data-[collapsible=icon]:p-2`,
        className,
      )}
      {...props}
    />
  )
}

type UserProps = {
  name: string
  className?: string
  trailing?: ReactNode
}

export function User({ name, className, trailing }: UserProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 group-data-[collapsible=icon]:items-center',
        className,
      )}
    >
      <div
        className={cn(
          `border-border bg-raised flex h-14 items-center gap-3 rounded-[18px]
          border px-2.5 [box-shadow:0_4px_0_var(--lip-sm)]
          group-data-[collapsible=icon]:w-auto
          group-data-[collapsible=icon]:justify-center
          group-data-[collapsible=icon]:border-0
          group-data-[collapsible=icon]:bg-transparent
          group-data-[collapsible=icon]:p-0
          group-data-[collapsible=icon]:[box-shadow:none]`,
        )}
      >
        <Avatar
          className="border-border bg-muted text-muted-foreground size-9 border
            group-data-[collapsible=icon]:size-10"
        >
          <AvatarFallback className="bg-transparent text-sm font-semibold">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className="flex-1 truncate text-[15px] font-semibold
            group-data-[collapsible=icon]:hidden"
        >
          {name}
        </span>
      </div>
      <div className="group-data-[collapsible=icon]:hidden">
        {trailing ?? <ThemeToggle />}
      </div>
    </div>
  )
}

type RailProps = ComponentProps<typeof SidebarRail>

export function Rail({ className, ...props }: RailProps) {
  return (
    <SidebarRail
      className={cn('hover:after:bg-border after:bg-border/40', className)}
      {...props}
    />
  )
}
