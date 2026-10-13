import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ArrowLeftRight,
  FileText,
  LayoutDashboard,
  Settings2,
  Wallet,
} from 'lucide-react'

import { ThemeProvider } from '@/components/providers/ThemeProvider'

import { AppSidebar } from './AppSidebar'
import type { SidebarNavItem } from './AppSidebar.types'

const items: Array<SidebarNavItem> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
  { id: 'statements', label: 'Statements', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

const meta = {
  title: 'v2/Desktop/App Sidebar',
  component: AppSidebar,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark">
        <div className="bg-background flex h-svh">
          <Story />
          <main className="min-w-0 flex-1 p-8">
            <h1 className="font-grotesk text-2xl font-semibold">
              Hi, Bernard!
            </h1>
          </main>
        </div>
      </ThemeProvider>
    ),
  ],
  args: {
    items,
    activeId: 'dashboard',
    userName: 'Bernard',
  },
} satisfies Meta<typeof AppSidebar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SettingsActive: Story = {
  args: {
    activeId: 'settings',
  },
}

export const Collapsed: Story = {
  args: {
    defaultOpen: false,
  },
}
