import type { ComponentType, ReactNode } from 'react'

export type SidebarIcon = ComponentType<{ className?: string }>

export type SidebarNavItem = {
  id: string
  label: string
  icon: SidebarIcon
  linkProvider?: ComponentType<{ children: ReactNode }>
}

export type AppSidebarProps = {
  items: Array<SidebarNavItem>
  activeId: string
  userName: string
  defaultOpen?: boolean
  onNavigate?: (id: string) => void
}
