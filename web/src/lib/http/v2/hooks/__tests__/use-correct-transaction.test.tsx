import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { InfiniteData } from '@tanstack/react-query'

import { queryKeys } from '../../../query-keys'
import type {
  StatementTransaction,
  StatementTransactionsResponse,
} from '../../types'
import { useCorrectTransaction } from '../use-correct-transaction'

// apiFetch reads VITE_API_URL and captures fetch when the module loads, so the
// stub has to be in place before the import graph runs.
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
          needs_review: true,
        },
      ],
      total: 1,
      review_count: 1,
      next_offset: null,
    },
  ],
  pageParams: [0],
}

const renderCorrection = (queryClient: QueryClient) =>
  renderHook(() => useCorrectTransaction(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })

function seed(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.statements.transactions, transactions)
  // A row opened from an expanded category: not part of the paginated pages.
  queryClient.setQueryData<StatementTransaction | null>(
    queryKeys.statements.selection,
    { ...transactions.pages[0].transactions[0], id: 'txn-selected' },
  )
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
}

describe('useCorrectTransaction', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    seed(queryClient)
    fetchMock.mockReset()
  })

  it('patches the row optimistically and invalidates the derived caches', async () => {
    let answer!: (response: Response) => void
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (answer = resolve)),
    )
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderCorrection(queryClient)

    act(() => {
      result.current.mutate({
        transactionId: 'txn-1',
        categoryId: 'shopping',
        isExpense: true,
        groupKey: 'expenses',
      })
    })

    // Before the server answers, the row already moved out of the queue.
    await waitFor(() => {
      const data = queryClient.getQueryData<
        InfiniteData<StatementTransactionsResponse>
      >(queryKeys.statements.transactions)
      expect(data?.pages[0].transactions[0].classification?.category?.id).toBe(
        'shopping',
      )
      expect(data?.pages[0].transactions[0].needs_review).toBe(false)
      expect(data?.pages[0].review_count).toBe(0)
    })

    act(() =>
      answer(
        new Response(
          JSON.stringify({
            id: 'txn-1',
            normalised_description: 'takealot',
            category_id: 'shopping',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.statements.transactions,
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.budget })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.categoryBudgets,
    })
  })

  it('rolls the optimistic patch back when the server rejects it', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const { result } = renderCorrection(queryClient)

    act(() => {
      result.current.mutate({
        transactionId: 'txn-1',
        categoryId: 'shopping',
        isExpense: true,
        groupKey: 'expenses',
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const data = queryClient.getQueryData<
      InfiniteData<StatementTransactionsResponse>
    >(queryKeys.statements.transactions)
    expect(data?.pages[0].transactions[0].needs_review).toBe(true)
    expect(data?.pages[0].transactions[0].classification).toBeNull()
    expect(data?.pages[0].review_count).toBe(1)
  })

  it('patches a selected row that the paginated pages do not hold', async () => {
    let answer!: (response: Response) => void
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (answer = resolve)),
    )
    const { result } = renderCorrection(queryClient)

    act(() => {
      result.current.mutate({
        transactionId: 'txn-selected',
        categoryId: 'shopping',
        isExpense: true,
        groupKey: 'expenses',
      })
    })

    await waitFor(() => {
      const selection = queryClient.getQueryData<StatementTransaction | null>(
        queryKeys.statements.selection,
      )
      expect(selection?.classification?.category?.id).toBe('shopping')
      expect(selection?.needs_review).toBe(false)
    })

    act(() =>
      answer(
        new Response(
          JSON.stringify({
            id: 'txn-selected',
            normalised_description: 'takealot',
            category_id: 'shopping',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls the selected snapshot back when the server rejects it', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const { result } = renderCorrection(queryClient)

    act(() => {
      result.current.mutate({
        transactionId: 'txn-selected',
        categoryId: 'shopping',
        isExpense: true,
        groupKey: 'expenses',
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const selection = queryClient.getQueryData<StatementTransaction | null>(
      queryKeys.statements.selection,
    )
    expect(selection?.needs_review).toBe(true)
    expect(selection?.classification).toBeNull()
  })
})
