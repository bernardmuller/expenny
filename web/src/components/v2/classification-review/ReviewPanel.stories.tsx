import type { Meta, StoryObj } from '@storybook/react-vite'

import { ReviewPanel } from './ReviewPanel'
import {
  mockCategoryOptions,
  mockReviewItems,
} from '../shared/__mocks__/review.mock'

const meta = {
  title: 'v2/Desktop/Review Panel',
  component: ReviewPanel,
  parameters: {
    layout: 'centered',
  },
  decorators: (Story) => (
    <div className="w-full max-w-sm p-4">
      <Story />
    </div>
  ),
  args: {
    item: mockReviewItems[1],
    index: 1,
    total: 3,
    displayName: 'Takealot',
    categoryId: 'shopping',
    categoryOptions: mockCategoryOptions,
    countsTowardBudget: true,
  },
} satisfies Meta<typeof ReviewPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ManuallyCategorised: Story = {
  args: {
    item: mockReviewItems[0],
    index: 0,
    displayName: 'Engen 1 Stop',
    categoryId: 'fuel',
  },
}
