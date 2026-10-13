import { fireEvent, render, screen } from '@testing-library/react'
import {
  ArrowLeftRight,
  FileText,
  LayoutDashboard,
  Settings2,
  Wallet,
} from 'lucide-react'

import { AppSidebar } from '../AppSidebar'
import type { SidebarNavItem } from '../AppSidebar.types'

const items: Array<SidebarNavItem> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
  { id: 'statements', label: 'Statements', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

describe('AppSidebar', () => {
  const onNavigate = vi.fn()

  beforeEach(() => {
    render(
      <AppSidebar
        items={items}
        activeId="dashboard"
        userName="Bernard"
        onNavigate={onNavigate}
      />,
    )
  })

  it('renders the brand and user', () => {
    expect(screen.getByText('Expenny')).toBeInTheDocument()
    expect(screen.getByText('Bernard')).toBeInTheDocument()
  })

  it('renders every navigation item', () => {
    for (const item of items) {
      expect(
        screen.getByRole('button', { name: item.label }),
      ).toBeInTheDocument()
    }
  })

  it('marks the active item', () => {
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'data-active',
      'true',
    )
  })

  it('calls onNavigate when an item is clicked', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Transactions' }))
    expect(onNavigate).toHaveBeenCalledWith('transactions')
  })

  it('collapses when the rail is clicked', () => {
    const sidebar = document.querySelector('[data-slot="sidebar"]')
    expect(sidebar).toHaveAttribute('data-state', 'expanded')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }))

    expect(sidebar).toHaveAttribute('data-state', 'collapsed')
  })
})
