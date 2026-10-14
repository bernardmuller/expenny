import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import type { IngestStatementResponse } from '../types'

export function useIngestStatement() {
  const queryClient = useQueryClient()
  const controllerRef = useRef<AbortController | null>(null)

  const mutation = useMutation({
    mutationKey: queryKeys.statements.ingest(),
    mutationFn: async (file: File): Promise<IngestStatementResponse> => {
      // A second import supersedes the first; the caller also has cancel().
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      const body = new FormData()
      body.append('file', file)

      return apiFetch<IngestStatementResponse>('/v2/statements', {
        method: 'POST',
        body,
        signal: controller.signal,
      })
    },
    onSuccess: (data) => {
      const skipped = data.skipped
      toast.success(
        `Imported ${data.processed} transaction${data.processed === 1 ? '' : 's'}`,
        skipped > 0
          ? { description: `${skipped} row(s) were skipped` }
          : undefined,
      )
      if (data.classification_error) {
        toast.warning('Some transactions still need categorising')
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.statements.transactions,
      })
    },
    onError: (error: Error) => {
      if (error.name === 'AbortError') return
      toast.error(error.message || 'Failed to import statement')
    },
  })

  return {
    ...mutation,
    cancel: () => controllerRef.current?.abort(),
  }
}
