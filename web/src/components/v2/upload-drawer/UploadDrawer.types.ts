export type UploadStepStatus = 'done' | 'active' | 'pending'

export type UploadStep = {
  id: string
  title: string
  description: string
  status: UploadStepStatus
  count?: string
  progress?: number
}

export type SortedTransaction = {
  id: string
  name: string
  emoji: string
  category: string
}

export type UploadDrawerProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  fileName: string
  fileRange: string
  steps: Array<UploadStep>
  sorted: Array<SortedTransaction>
  onCancel?: () => void
}
