import { toast } from 'sonner'

import { queryKeys } from '../../query-keys'
import { apiFetch } from '../client'
import type { MeResponse } from '../types'

async function fetchMe(): Promise<MeResponse> {
  try {
    return await apiFetch<MeResponse>('/v2/me')
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Failed to load your profile',
    )
    throw error
  }
}

export function getMeQueryOptions() {
  return {
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: 60 * 60 * 1000,
  }
}
