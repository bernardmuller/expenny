import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import { invalidateStatementData } from '../cache'
import type {
  ClassificationStatusResponse,
  ClassifiedTransaction,
  ClassifyTransactionsResponse,
  IngestStatementResponse,
} from '../types'

/** How many pending rows one classify request processes. One batch runs the
 * classifier's own worker pool once, which keeps each request well inside the
 * gateway timeout and moves the import along in visible steps. */
const CLASSIFY_BATCH = 6

const RECENT_ROWS = 5

export type IngestInput =
  | { kind: 'file'; file: File }
  | { kind: 'csv'; csv: string }
  /** Continue classifying rows left over from an interrupted import. */
  | { kind: 'resume'; total: number }

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
 * Imports a statement in two steps: the CSV is stored first, then the stored
 * rows are classified in batches. Classification is a plain request/response
 * loop rather than a streaming response, so progress is visible per batch and
 * the API stays serverless-friendly.
 *
 * The loop lives here, in the dashboard, not in the drawer, so closing the
 * drawer no longer stops the import. On mount the hook checks for rows left
 * unclassified by an interrupted import (a closed tab, for example) and picks
 * the work back up.
 */
export function useIngestStatement() {
  const queryClient = useQueryClient()
  const controllerRef = useRef<AbortController | null>(null)
  const resumeCheckedRef = useRef(false)
  const [progress, setProgress] = useState<IngestProgress>(EMPTY_PROGRESS)

  const mutation = useMutation({
    mutationKey: queryKeys.statements.ingest(),
    mutationFn: async (input: IngestInput): Promise<IngestResult> => {
      // A second import supersedes the first; the caller also has cancel().
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      setProgress(EMPTY_PROGRESS)

      const stored =
        input.kind === 'resume'
          ? null
          : await storeStatement(input, controller.signal)

      // The date range is known as soon as the statement is stored, so show it
      // while the first batch is still being classified.
      if (stored) {
        setProgress({
          ...EMPTY_PROGRESS,
          from: toMillis(stored.from),
          to: toMillis(stored.to),
        })
      }

      let total =
        input.kind === 'resume' ? input.total : (stored?.processed ?? 0)
      let processed = 0
      let classified = 0
      let needsReview = 0
      let failed = 0
      let alreadyClassified = 0
      let from = toMillis(stored?.from)
      let to = toMillis(stored?.to)
      let recent: Array<IngestedTransactionRow> = []
      let pending = total
      let isFirstBatch = true

      while (pending > 0) {
        if (controller.signal.aborted) throw abortError()
        const pendingBefore = pending

        const response = await apiFetch<ClassifyTransactionsResponse>(
          '/v2/statements/classify',
          {
            method: 'POST',
            body: { limit: CLASSIFY_BATCH },
            signal: controller.signal,
          },
        )

        if (isFirstBatch) {
          // A re-import can contain rows that were already classified; the
          // first batch reveals the real amount of work left.
          total = response.rows.length + response.pending
          isFirstBatch = false
        }

        alreadyClassified += response.skipped
        for (const row of response.rows) {
          processed += 1

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

        pending = response.pending
        setProgress({
          total,
          processed,
          classified,
          needsReview,
          failed,
          alreadyClassified,
          from,
          to,
          rows: recent,
        })

        // A batch the classifier could not store leaves its rows pending, so
        // looping again would hammer the provider forever. Stop when nothing
        // was saved and the queue did not move; the rows stay queued for a
        // future retry.
        const saved = response.rows.filter((row) => !row.error).length
        if (saved === 0 && pending >= pendingBefore) {
          throw new Error('Could not categorise the remaining transactions')
        }
      }

      return {
        total,
        processed,
        classified,
        needsReview,
        failed,
        alreadyClassified,
        from,
        to,
        rows: recent,
        stored: stored?.processed ?? 0,
        parseSkipped: stored?.skipped ?? 0,
        errors: stored?.errors ?? [],
      }
    },
    onSuccess: (data, input) => {
      const parts: Array<string> = []
      if (data.classified > 0) parts.push(`${data.classified} categorised`)
      if (data.needsReview > 0) parts.push(`${data.needsReview} need review`)
      if (data.failed > 0) parts.push(`${data.failed} failed`)

      if (input.kind === 'resume') {
        toast.success('Finished categorising your statement', {
          description: parts.length > 0 ? parts.join(' · ') : undefined,
        })
      } else {
        toast.success(
          `Imported ${data.stored} transaction${data.stored === 1 ? '' : 's'}`,
          {
            description: parts.length > 0 ? parts.join(' · ') : undefined,
          },
        )
      }

      const skipped = data.parseSkipped + data.failed
      if (skipped > 0) {
        toast.warning(`${skipped} row(s) still need attention`)
      }

      // The import moved money through balances and categories, so every
      // statement-derived cache has to refetch.
      invalidateStatementData(queryClient)
    },
    onError: (error: Error, input: IngestInput) => {
      if (error.name === 'AbortError') return
      // A failed resume is usually provider trouble the user never asked
      // about; the next dashboard visit quietly retries it.
      if (input.kind === 'resume') return
      toast.error(error.message || 'Failed to import statement')
    },
  })

  const cancel = useCallback(() => controllerRef.current?.abort(), [])

  // Pick up anything an earlier visit left unclassified. The check runs once
  // per mount and never interrupts an import the user has already started.
  const { mutate } = mutation
  useEffect(() => {
    if (resumeCheckedRef.current) return
    resumeCheckedRef.current = true

    const lifecycle = new AbortController()
    void (async () => {
      try {
        const status = await apiFetch<ClassificationStatusResponse>(
          '/v2/statements/classification/status',
        )
        if (
          !lifecycle.signal.aborted &&
          status.pending > 0 &&
          !controllerRef.current
        ) {
          mutate({ kind: 'resume', total: status.pending })
        }
      } catch {
        // Resuming is best effort; the next visit tries again.
      }
    })()

    return () => {
      lifecycle.abort()
    }
  }, [mutate])

  return {
    ...mutation,
    progress,
    cancel,
  }
}

async function storeStatement(
  input: Exclude<IngestInput, { kind: 'resume' }>,
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

function toProgressRow(row: ClassifiedTransaction): IngestedTransactionRow {
  return {
    id: row.id,
    name: row.description.trim() || row.original_description.trim(),
    emoji: row.category?.icon ?? '❔',
    category: row.category?.label ?? 'Uncategorised',
  }
}

function toMillis(value: string | null | undefined): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function abortError() {
  return new DOMException('The import was cancelled', 'AbortError')
}
