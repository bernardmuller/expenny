import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeftRight, FileText, Home, Wallet } from 'lucide-react'

import { MobileNav } from './MobileNav'
import type { MobileNavItem } from './MobileNav.types'

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

const meta = {
  title: 'v2/Mobile/Mobile Nav',
  component: MobileNav,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="bg-background font-body text-foreground min-h-svh p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    userName: 'Bernard',
    items,
    activeId: 'dashboard',
  },
} satisfies Meta<typeof MobileNav>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ActivityActive: Story = {
  args: {
    activeId: 'transactions',
  },
}
