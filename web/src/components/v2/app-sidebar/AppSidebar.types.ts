import type { ComponentType, ReactNode } from 'react'

export type SidebarIcon = ComponentType<{ className?: string }>

export type SidebarNavItem = {
  id: string
  label: string
  icon: SidebarIcon
  /** Hex accent used to tint the icon tile. Defaults to grey. */
  accent?: string
  /** Optional gold count badge, e.g. transactions needing review. */
  badge?: number | string
  linkProvider?: ComponentType<{ children: ReactNode }>
}

export type AppSidebarProps = {
  items: Array<SidebarNavItem>
  activeId: string
  userName: string
  defaultOpen?: boolean
  onNavigate?: (id: string) => void
  onUpload?: () => void
  onPaste?: () => void
}
