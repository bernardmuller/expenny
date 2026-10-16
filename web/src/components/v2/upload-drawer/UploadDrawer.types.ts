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

/** Where the import is in its lifecycle. `idle` is the start screen. */
export type UploadDrawerStatus = 'idle' | 'importing' | 'success'

export type UploadSummary = {
  processed: number
  classified: number
  needsReview: number
  failed: number
  parseSkipped: number
}

export type UploadDrawerProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  status?: UploadDrawerStatus
  fileName: string
  fileRange: string
  csvText?: string
  onCsvTextChange?: (value: string) => void
  onPasteSubmit?: () => void
  onFile?: (file: File) => void
  steps: Array<UploadStep>
  sorted: Array<SortedTransaction>
  summary?: UploadSummary
  onCancel?: () => void
  onDone?: () => void
}
