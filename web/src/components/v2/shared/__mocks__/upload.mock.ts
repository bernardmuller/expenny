import type {
  SortedTransaction,
  UploadStep,
} from '../../upload-drawer/UploadDrawer.types'

export const mockUploadSteps: Array<UploadStep> = [
  {
    id: 'read',
    title: 'Read file',
    description: '48 transactions found',
    status: 'done',
  },
  {
    id: 'sort',
    title: 'Sorting into categories',
    description: 'Matching merchants to your categories',
    status: 'active',
    count: '41 of 48',
    progress: 85,
  },
  {
    id: 'review',
    title: 'Ready to review',
    description: "We'll flag anything we're unsure about",
    status: 'pending',
  },
]

export const mockSortedTransactions: Array<SortedTransaction> = [
  { id: 'sorted-1', name: 'Netflix', emoji: '🎬', category: 'Subscriptions' },
  { id: 'sorted-2', name: 'Afrihost', emoji: '🌐', category: 'Utilities' },
  {
    id: 'sorted-3',
    name: 'Easy Equities TFSA',
    emoji: '📈',
    category: 'Investments',
  },
]
