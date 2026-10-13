import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/ui/button'

import { UploadDrawer } from './UploadDrawer'
import {
  mockSortedTransactions,
  mockUploadSteps,
} from '../shared/__mocks__/upload.mock'

const meta = {
  title: 'v2/Mobile/Upload Drawer',
  component: UploadDrawer,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    open: true,
    fileName: 'capitec_oct_2026.csv',
    fileRange: '1 to 12 Oct 2026',
    steps: mockUploadSteps,
    sorted: mockSortedTransactions,
  },
} satisfies Meta<typeof UploadDrawer>

export default meta

type Story = StoryObj<typeof meta>

export const Importing: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true)

    return (
      <div className="flex min-h-svh items-center justify-center p-8">
        <Button onClick={() => setOpen(true)}>Upload statement</Button>
        <UploadDrawer
          {...args}
          open={open}
          onOpenChange={setOpen}
          onCancel={() => setOpen(false)}
        />
      </div>
    )
  },
}
