import type { Meta, StoryObj } from '@storybook/react-vite'

import { ReviewCard } from './ReviewCard'
import { mockReviewItems } from '../shared/__mocks__/review.mock'

const meta = {
  title: 'v2/Mobile/Review Card',
  component: ReviewCard,
  parameters: {
    layout: 'centered',
  },
  decorators: (Story) => (
    <div className="w-full max-w-md p-4">
      <Story />
    </div>
  ),
} satisfies Meta<typeof ReviewCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { item: mockReviewItems[0], index: 0, total: 3 },
}

export const LastItem: Story = {
  args: { item: mockReviewItems[2], index: 2, total: 3 },
}

export const LowConfidence: Story = {
  args: { item: mockReviewItems[1], index: 1, total: 3 },
}
