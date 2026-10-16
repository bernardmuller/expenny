import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { InfiniteData } from '@tanstack/react-query'

import { queryKeys } from '../../../query-keys'
import type { StatementTransactionsResponse } from '../../types'
import { useUpdateTransactionCategory } from '../use-update-transaction-category'

const { fetchMock } = vi.hoisted(() => {
  import.meta.env.VITE_API_URL = 'http://api.test'
  const mock = vi.fn()
  globalThis.fetch = mock as unknown as typeof fetch
  return { fetchMock: mock }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const transactions: InfiniteData<StatementTransactionsResponse> = {
  pages: [
    {
      transactions: [
        {
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
          classification: null,
          needs_review: false,
        },
      ],
      total: 1,
      review_count: 0,
      next_offset: null,
    },
  ],
  pageParams: [0],
}

function renderMutation(queryClient: QueryClient) {
  return renderHook(() => useUpdateTransactionCategory(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

describe('useUpdateTransactionCategory', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    queryClient.setQueryData(queryKeys.statements.transactions, transactions)
    queryClient.setQueryData(queryKeys.statements.categories, {
      categories: [
        {
          id: 'shopping',
          key: 'shopping',
          label: 'Shopping',
          icon: '📦',
          groups: [{ id: 'g-1', key: 'expenses', label: 'Expenses' }],
        },
      ],
    })

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'txn-1',
          category_id: 'shopping',
          group: 'expenses',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  })

  it('writes to the category endpoint, not the corrections endpoint', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderMutation(queryClient)

    act(() => {
      result.current.mutate({
        transactionId: 'txn-1',
        categoryId: 'shopping',
        isExpense: true,
        groupKey: 'expenses',
      })
    })

    // The row is re-categorised immediately.
    await waitFor(() => {
      const data = queryClient.getQueryData<
        InfiniteData<StatementTransactionsResponse>
      >(queryKeys.statements.transactions)
      expect(data?.pages[0].transactions[0].classification?.category?.id).toBe(
        'shopping',
      )
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v2/statements/transactions/txn-1/category',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/correction'),
      ),
    ).toBe(false)

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.statements.transactions,
    })
  })
})
