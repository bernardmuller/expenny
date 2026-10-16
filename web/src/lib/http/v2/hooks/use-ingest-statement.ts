import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import { invalidateStatementData } from '../cache'
import type {
  ClassifiedTransaction,
  ClassifyTransactionsResponse,
  IngestStatementResponse,
} from '../types'

/** How many transactions are classified at the same time. The classifier
 * itself fans out to its own workers, so one row per request keeps every
 * provider call busy while still ticking the counter row by row. */
const CLASSIFY_CONCURRENCY = 6

const RECENT_ROWS = 5

export type IngestInput =
  | { kind: 'file'; file: File }
  | { kind: 'csv'; csv: string }

export type IngestedTransactionRow = {
  id: string
  name: string
  emoji: string
  category: string
}

export type IngestProgress = {
  /** Rows that were stored and now need a classification. */
  total: number
  /** Classify responses that have come back. */
  processed: number
  /** Rows that were given a category. */
  classified: number
  /** Rows the classifier flagged for a human. */
  needsReview: number
  /** Rows whose classification failed. */
  failed: number
  /** Rows that already had a classification and were left alone. */
  alreadyClassified: number
  /** Epoch millis of the earliest and latest classified row, if any. */
  from: number | null
  to: number | null
  /** The most recently classified rows, newest first. */
  rows: Array<IngestedTransactionRow>
}

export type IngestResult = IngestProgress & {
  /** Rows stored from the statement. */
  stored: number
  /** Rows the parser could not read. */
  parseSkipped: number
  errors: Array<string>
}

const EMPTY_PROGRESS: IngestProgress = {
  total: 0,
  processed: 0,
  classified: 0,
  needsReview: 0,
  failed: 0,
  alreadyClassified: 0,
  from: null,
  to: null,
  rows: [],
}

/**
 * Imports a statement in two steps: the CSV is stored first, then the client
 * classifies the stored rows in small batches. Doing classification as a
 * client-driven loop means progress is visible per transaction and the API
 * stays a plain request/response service (no streaming support needed).
 */
export function useIngestStatement() {
  const queryClient = useQueryClient()
  const controllerRef = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<IngestProgress>(EMPTY_PROGRESS)

  const mutation = useMutation({
    mutationKey: queryKeys.statements.ingest(),
    mutationFn: async (input: IngestInput): Promise<IngestResult> => {
      // A second import supersedes the first; the caller also has cancel().
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      setProgress(EMPTY_PROGRESS)

      const stored = await storeStatement(input, controller.signal)

      let processed = 0
      let classified = 0
      let needsReview = 0
      let failed = 0
      let alreadyClassified = 0
      let from: number | null = null
      let to: number | null = null
      let recent: Array<IngestedTransactionRow> = []

      await classifyAll(
        stored.transaction_ids,
        controller.signal,
        (response) => {
          processed += 1
          alreadyClassified += response.skipped

          const row = response.rows.at(0)
          if (row) {
            if (row.error) {
              failed += 1
              needsReview += 1
            } else {
              classified += 1
              if (row.needs_review) needsReview += 1
              recent = [toProgressRow(row), ...recent].slice(0, RECENT_ROWS)
            }

            const time = new Date(row.transaction_date).getTime()
            if (!Number.isNaN(time)) {
              from = from === null ? time : Math.min(from, time)
              to = to === null ? time : Math.max(to, time)
            }
          }

          setProgress({
            total: stored.transaction_ids.length,
            processed,
            classified,
            needsReview,
            failed,
            alreadyClassified,
            from,
            to,
            rows: recent,
          })
        },
      ).catch((error: unknown) => {
        // Stop the workers still in flight so no work continues after the
        // import has given up.
        controller.abort()
        throw error
      })

      return {
        total: stored.transaction_ids.length,
        processed,
        classified,
        needsReview,
        failed,
        alreadyClassified,
        from,
        to,
        rows: recent,
        stored: stored.processed,
        parseSkipped: stored.skipped,
        errors: stored.errors ?? [],
      }
    },
    onSuccess: (data) => {
      const skipped = data.parseSkipped + data.failed
      const parts: Array<string> = []
      if (data.classified > 0) parts.push(`${data.classified} categorised`)
      if (data.needsReview > 0) parts.push(`${data.needsReview} need review`)
      if (data.failed > 0) parts.push(`${data.failed} failed`)

      toast.success(
        `Imported ${data.stored} transaction${data.stored === 1 ? '' : 's'}`,
        {
          description: parts.length > 0 ? parts.join(' · ') : undefined,
        },
      )
      if (skipped > 0) {
        toast.warning(`${skipped} row(s) still need attention`)
      }

      // The import moved money through balances and categories, so every
      // statement-derived cache has to refetch.
      invalidateStatementData(queryClient)
    },
    onError: (error: Error) => {
      if (error.name === 'AbortError') return
      toast.error(error.message || 'Failed to import statement')
    },
  })

  const cancel = useCallback(() => controllerRef.current?.abort(), [])

  return {
    ...mutation,
    progress,
    cancel,
  }
}

async function storeStatement(
  input: IngestInput,
  signal: AbortSignal,
): Promise<IngestStatementResponse> {
  if (input.kind === 'file') {
    const body = new FormData()
    body.append('file', input.file)
    return apiFetch<IngestStatementResponse>('/v2/statements', {
      method: 'POST',
      body,
      signal,
    })
  }

  return apiFetch<IngestStatementResponse>('/v2/statements', {
    method: 'POST',
    body: { csv: input.csv },
    signal,
  })
}

async function classifyAll(
  ids: Array<string>,
  signal: AbortSignal,
  onResult: (response: ClassifyTransactionsResponse) => void,
): Promise<void> {
  let cursor = 0

  const worker = async () => {
    while (cursor < ids.length) {
      if (signal.aborted) return
      const id = ids[cursor++]
      const response = await apiFetch<ClassifyTransactionsResponse>(
        '/v2/statements/classify',
        {
          method: 'POST',
          body: { transaction_ids: [id] },
          signal,
        },
      )
      onResult(response)
    }
  }

  const workers = Math.min(CLASSIFY_CONCURRENCY, ids.length)
  await Promise.all(Array.from({ length: workers }, worker))
}

function toProgressRow(row: ClassifiedTransaction): IngestedTransactionRow {
  return {
    id: row.id,
    name: row.description.trim() || row.original_description.trim(),
    emoji: row.category?.icon ?? '❔',
    category: row.category?.label ?? 'Uncategorised',
  }
}
