import { Wallet } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils/cn'

type ProviderProps = ComponentProps<typeof SidebarProvider>

export function Provider({ className, ...props }: ProviderProps) {
  return (
    <SidebarProvider className={cn('min-h-0 w-auto', className)} {...props} />
  )
}

type RootProps = ComponentProps<typeof Sidebar>

export function Root({ className, ...props }: RootProps) {
  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        'bg-background [&>[data-slot=sidebar-inner]]:bg-background',
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
      className={cn('p-4 group-data-[collapsible=icon]:p-2', className)}
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
        `flex items-center gap-3 px-1
        group-data-[collapsible=icon]:justify-center
        group-data-[collapsible=icon]:px-0`,
        className,
      )}
    >
      <span
        className="bg-primary text-primary-foreground flex size-10 shrink-0
          items-center justify-center rounded-xl"
      >
        <Wallet className="size-5" />
      </span>
      <span
        className="font-grotesk text-lg font-semibold
          group-data-[collapsible=icon]:hidden"
      >
        {name}
      </span>
    </div>
  )
}

export function Content({
  className,
  ...props
}: ComponentProps<typeof SidebarContent>) {
  return (
    <SidebarContent
      className={cn('px-3 py-2 group-data-[collapsible=icon]:px-2', className)}
      {...props}
    />
  )
}

export function Nav({
  className,
  ...props
}: ComponentProps<typeof SidebarMenu>) {
  return <SidebarMenu className={cn('gap-1', className)} {...props} />
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
        `data-[active=true]:bg-primary/15 data-[active=true]:text-primary h-11
        rounded-xl px-3 text-sm font-medium`,
        className,
      )}
      {...props}
    />
  )
}

export function Footer({
  className,
  ...props
}: ComponentProps<typeof SidebarFooter>) {
  return (
    <SidebarFooter
      className={cn('p-4 group-data-[collapsible=icon]:p-2', className)}
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
        'flex items-center gap-3 group-data-[collapsible=icon]:justify-center',
        className,
      )}
    >
      <Avatar className="size-9">
        <AvatarFallback className="font-grotesk text-sm">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span
        className="font-grotesk flex-1 truncate text-sm font-medium
          group-data-[collapsible=icon]:hidden"
      >
        {name}
      </span>
      <span className="contents group-data-[collapsible=icon]:hidden">
        {trailing ?? <ThemeToggle />}
      </span>
    </div>
  )
}

type RailProps = ComponentProps<typeof SidebarRail>

export function Rail({ className, ...props }: RailProps) {
  return <SidebarRail className={className} {...props} />
}
