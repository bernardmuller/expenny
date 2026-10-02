import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useDeleteExpense } from '../use-delete-expense'
import { queryKeys } from '../../query-keys'

const USER_ID = '11111111-1111-1111-1111-111111111111'
const BUDGET_ID = '22222222-2222-2222-2222-222222222222'
const EXPENSE_ID = '33333333-3333-3333-3333-333333333333'

// Hoisted: openapi-fetch captures globalThis.fetch and reads VITE_API_URL when
// the client module loads, which happens before any beforeEach runs. The app
// ships an empty base URL (same-origin via the Vite proxy), but Node's Request
// rejects relative URLs, so give it an absolute one here.
const { fetchMock } = vi.hoisted(() => {
  import.meta.env.VITE_API_URL = 'http://api.test'
  const mock = vi.fn()
  globalThis.fetch = mock as unknown as typeof fetch
  return { fetchMock: mock }
})

// Both decode-token and with-token read the signed-in user from here.
vi.mock('@/lib/auth/token-storage', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // hasSession closes over the real getSessionToken, so stub it directly.
  hasSession: () => true,
  getSessionToken: () => 'session-token',
  getStoredCurrentUser: () => ({
    userId: USER_ID,
    email: 'a@b.c',
    name: 'Tester',
  }),
}))

// The shape `GET /budgets/{id}/expenses` actually returns: a flat budget that
// carries its expenses. There is no nested `budget` property — assuming one
// made onMutate throw, which aborted the mutation before mutationFn ran.
const budgetExpensesResponse = {
  id: BUDGET_ID,
  userId: USER_ID,
  name: 'October',
  startAmount: '10000',
  currentAmount: '7000',
  isActive: true,
  expenses: [
    {
      id: EXPENSE_ID,
      budgetId: BUDGET_ID,
      description: 'Flat white',
      amount: '50',
      createdAt: '2026-10-01T00:00:00.000Z',
      category: { id: 'c1', key: 'coffee', label: 'Coffee', icon: '☕' },
    },
  ],
}

const renderDeleteExpense = (queryClient: QueryClient) =>
  renderHook(() => useDeleteExpense(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })

describe('useDeleteExpense', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    queryClient.setQueryData(
      queryKeys.budgets.expenses(BUDGET_ID),
      budgetExpensesResponse,
    )

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: EXPENSE_ID, amount: '50' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('issues the DELETE request', async () => {
    const { result } = renderDeleteExpense(queryClient)

    result.current.mutate({ budgetId: BUDGET_ID, expenseId: EXPENSE_ID })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const firstArg = fetchMock.mock.calls[0][0] as Request | string
    const url = firstArg instanceof Request ? firstArg.url : String(firstArg)
    expect(url).toContain(
      `/users/${USER_ID}/budgets/${BUDGET_ID}/expenses/${EXPENSE_ID}`,
    )
  })

  it('optimistically removes the expense and credits the amount back', async () => {
    const { result } = renderDeleteExpense(queryClient)

    result.current.mutate({ budgetId: BUDGET_ID, expenseId: EXPENSE_ID })

    await waitFor(() => {
      const cached = queryClient.getQueryData<typeof budgetExpensesResponse>(
        queryKeys.budgets.expenses(BUDGET_ID),
      )
      expect(cached?.expenses).toHaveLength(0)
      expect(cached?.currentAmount).toBe('7050')
    })
  })

  it('rolls the expense back when the request fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Nope' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const { result } = renderDeleteExpense(queryClient)

    result.current.mutate({ budgetId: BUDGET_ID, expenseId: EXPENSE_ID })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const cached = queryClient.getQueryData<typeof budgetExpensesResponse>(
      queryKeys.budgets.expenses(BUDGET_ID),
    )
    expect(cached?.expenses).toHaveLength(1)
    expect(cached?.currentAmount).toBe('7000')
  })
})
