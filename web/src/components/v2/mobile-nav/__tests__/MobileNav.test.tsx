import { fireEvent, render, screen } from '@testing-library/react'
import { ArrowLeftRight, FileText, Home, Wallet } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { MobileNav } from '../MobileNav'
import type { MobileNavItem } from '../MobileNav.types'

const items: Array<MobileNavItem> = [
  { id: 'dashboard', label: 'Home', icon: Home, accent: '#4cc38a' },
  {
    id: 'transactions',
    label: 'Activity',
    icon: ArrowLeftRight,
    accent: '#5bb5ff',
    badge: 3,
  },
  { id: 'budgets', label: 'Budgets', icon: Wallet, accent: '#f472b6' },
  { id: 'statements', label: 'Files', icon: FileText, accent: '#a78bfa' },
]

describe('MobileNav', () => {
  it('renders the brand and every navigation item', () => {
    render(<MobileNav userName="Bernard" items={items} activeId="dashboard" />)

    expect(screen.getByText('Expenny')).toBeInTheDocument()
    expect(screen.getByText('Hi, Bernard!')).toBeInTheDocument()

    for (const item of items) {
      expect(
        screen.getByRole('button', { name: new RegExp(item.label) }),
      ).toBeInTheDocument()
    }

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('marks the active item', () => {
    render(<MobileNav userName="Bernard" items={items} activeId="budgets" />)

    expect(screen.getByRole('button', { name: 'Budgets' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('calls onNavigate and onUpload', () => {
    const onNavigate = vi.fn()
    const onUpload = vi.fn()

    render(
      <MobileNav
        userName="Bernard"
        items={items}
        activeId="dashboard"
        onNavigate={onNavigate}
        onUpload={onUpload}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Budgets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Upload CSV' }))

    expect(onNavigate).toHaveBeenCalledWith('budgets')
    expect(onUpload).toHaveBeenCalledTimes(1)
  })
})
