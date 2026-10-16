import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { InfiniteData } from '@tanstack/react-query'

import { queryKeys } from '../../../query-keys'
import type {
  StatementTransaction,
  StatementTransactionsResponse,
} from '../../types'
import { useMarkTransactionSeen } from '../use-mark-transaction-seen'

const { fetchMock } = vi.hoisted(() => {
  import.meta.env.VITE_API_URL = 'http://api.test'
  const mock = vi.fn()
  globalThis.fetch = mock as unknown as typeof fetch
  return { fetchMock: mock }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const transaction: StatementTransaction = {
  id: 'txn-1',
  nr: 1,
  account: 'Capitec',
  posting_date: '2026-10-11T00:00:00Z',
  transaction_date: '2026-10-11T14:32:00Z',
  description: 'TAKEALOT.COM ORDER 77402',
  original_description: 'TAKEALOT.COM',
  parent_category: null,
  category: null,
  money_in: '0.00',
  money_out: '899.00',
  fee: '0.00',
  balance: '30000.00',
  classification: {
    id: 'classification-1',
    category: { id: 'shopping', key: 'shopping', label: 'Shopping', icon: '📦' },
    is_expense: true,
    expense_prob: 0.9,
    confidence: 0.9,
    source: 'provider',
    group: 'expenses',
    classified_at: '2026-10-11T10:00:00Z',
    seen_at: null,
  },
  needs_review: false,
}

const transactions: InfiniteData<StatementTransactionsResponse> = {
  pages: [
    {
      transactions: [
        transaction,
        { ...transaction, id: 'txn-2' },
        { ...transaction, id: 'txn-3' },
      ],
      total: 3,
      review_count: 0,
      next_offset: null,
    },
  ],
  pageParams: [0],
}

function renderMutation(queryClient: QueryClient) {
  return renderHook(() => useMarkTransactionSeen(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

function seenAtInCache(queryClient: QueryClient) {
  return queryClient.getQueryData<InfiniteData<StatementTransactionsResponse>>(
    queryKeys.statements.transactions,
  )?.pages[0].transactions[0].classification?.seen_at
}

function seenFlags(queryClient: QueryClient) {
  return queryClient
    .getQueryData<InfiniteData<StatementTransactionsResponse>>(
      queryKeys.statements.transactions,
    )
    ?.pages[0].transactions.map(
      (row) => row.classification?.seen_at != null,
    )
}

describe('useMarkTransactionSeen', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    queryClient.setQueryData(queryKeys.statements.transactions, transactions)
    fetchMock.mockReset()
  })

  it('stamps the row optimistically and keeps the server time', async () => {
    let answer!: (response: Response) => void
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (answer = resolve)),
    )

    const { result } = renderMutation(queryClient)
    act(() => result.current.mutate('txn-1'))

    // The highlight clears before the server has answered.
    await waitFor(() => expect(seenAtInCache(queryClient)).not.toBeNull())

    // Only the ticked row moves.
    expect(seenFlags(queryClient)).toEqual([true, false, false])

    act(() =>
      answer(
        new Response(JSON.stringify({ seen_at: '2026-10-11T12:00:00Z' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(seenAtInCache(queryClient)).toBe('2026-10-11T12:00:00Z')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v2/statements/transactions/txn-1/seen',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('puts the highlight back when the server rejects the tick', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'no classification' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { result } = renderMutation(queryClient)
    act(() => result.current.mutate('txn-1'))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(seenAtInCache(queryClient)).toBeNull()
    expect(seenFlags(queryClient)).toEqual([false, false, false])
  })
})
