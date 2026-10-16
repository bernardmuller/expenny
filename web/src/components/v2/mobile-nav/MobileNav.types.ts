import type { CSSProperties, ComponentType } from 'react'

export type MobileNavIcon = ComponentType<{
  className?: string
  style?: CSSProperties
}>

export type MobileNavItem = {
  id: string
  label: string
  icon: MobileNavIcon
  /** Hex accent used to tint the tab icon. Defaults to grey. */
  accent?: string
  /** Optional gold count badge, e.g. transactions needing review. */
  badge?: number | string
}

export type MobileNavProps = {
  userName: string
  items: Array<MobileNavItem>
  activeId: string
  onNavigate?: (id: string) => void
  onUpload?: () => void
  onPaste?: () => void
}
