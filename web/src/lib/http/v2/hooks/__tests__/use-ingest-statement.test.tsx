import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

import { useIngestStatement } from '../use-ingest-statement'

// apiFetch reads VITE_API_URL and captures fetch when the module loads, so the
// stub has to be in place before the import graph runs.
const { fetchMock } = vi.hoisted(() => {
  import.meta.env.VITE_API_URL = 'http://api.test'
  const mock = vi.fn()
  globalThis.fetch = mock as unknown as typeof fetch
  return { fetchMock: mock }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const row = (id: string, needsReview = false) => ({
  id,
  description: id,
  original_description: id,
  transaction_date: '2026-10-11T14:32:00Z',
  category: { id: 'shopping', key: 'shopping', label: 'Shopping', icon: '📦' },
  is_expense: true,
  confidence: 0.9,
  group: 'expenses',
  needs_review: needsReview,
})

const status = (pending: number) => ({
  total: 3,
  classified: 3 - pending,
  pending,
  needs_review: 0,
})

function renderIngest(queryClient: QueryClient) {
  return renderHook(() => useIngestStatement(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

describe('useIngestStatement', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    })
    fetchMock.mockReset()
  })

  it('stores the statement and classifies pending rows in batches', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/classification/status')) return json(status(0))
      if (url.endsWith('/statements/classify')) {
        const calls = fetchMock.mock.calls.filter(([target]) =>
          String(target).endsWith('/statements/classify'),
        ).length
        return calls === 1
          ? json({ rows: [row('txn-1'), row('txn-2')], skipped: 0, pending: 1 })
          : json({ rows: [row('txn-3', true)], skipped: 0, pending: 0 })
      }
      return json({
        processed: 3,
        skipped: 0,
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-12T00:00:00Z',
      })
    })

    const { result } = renderIngest(queryClient)
    act(() => result.current.mutate({ kind: 'csv', csv: 'a,b\n1,2' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toMatchObject({
      stored: 3,
      total: 3,
      processed: 3,
      classified: 3,
      needsReview: 1,
    })
    // The loop drives the server batch by batch until nothing is pending.
    const classifyCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/statements/classify'),
    )
    expect(classifyCalls).toHaveLength(2)
    expect(classifyCalls[0][1]).toMatchObject({ body: '{"limit":6}' })
  })

  it('resumes left-over work on mount without a new upload', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/classification/status')) return json(status(2))
      if (url.endsWith('/statements/classify')) {
        return json({ rows: [row('txn-1'), row('txn-2')], skipped: 0, pending: 0 })
      }
      return json({ processed: 0, skipped: 0, from: null, to: null })
    })

    const { result } = renderIngest(queryClient)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ stored: 0, classified: 2 })
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/classification/status'),
      ),
    ).toBe(true)
  })

  it('keeps going when other rows were already pending', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/classification/status')) return json(status(0))
      if (url.endsWith('/statements/classify')) {
        const calls = fetchMock.mock.calls.filter(([target]) =>
          String(target).endsWith('/statements/classify'),
        ).length
        // The first batch reveals rows the client did not know about, so the
        // queue grows instead of shrinking for one round.
        return calls === 1
          ? json({ rows: [row('txn-1')], skipped: 0, pending: 40 })
          : json({ rows: [row('txn-2')], skipped: 0, pending: 0 })
      }
      return json({ processed: 1, skipped: 0, from: null, to: null })
    })

    const { result } = renderIngest(queryClient)
    act(() => result.current.mutate({ kind: 'csv', csv: 'a,b\n1,2' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ total: 41, processed: 2 })
  })

  it('stops the loop when a batch cannot be saved', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/classification/status')) return json(status(0))
      if (url.endsWith('/statements/classify')) {
        return json({
          rows: [{ ...row('txn-1'), category: null, error: 'provider down' }],
          skipped: 0,
          pending: 2,
        })
      }
      return json({ processed: 2, skipped: 0, from: null, to: null })
    })

    const { result } = renderIngest(queryClient)
    act(() => result.current.mutate({ kind: 'csv', csv: 'a,b\n1,2' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/remaining transactions/)
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/statements/classify'),
      ),
    ).toHaveLength(1)
  })

  it('stops the loop when the import is cancelled', async () => {
    fetchMock.mockImplementation(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          if (url.endsWith('/classification/status')) {
            resolve(json(status(0)))
            return
          }
          if (url.endsWith('/statements/classify')) {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
            return
          }
          resolve(json({ processed: 2, skipped: 0, from: null, to: null }))
        }),
    )

    const { result } = renderIngest(queryClient)
    act(() => result.current.mutate({ kind: 'csv', csv: 'a,b\n1,2' }))

    await waitFor(() => expect(result.current.isPending).toBe(true))
    act(() => result.current.cancel())

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.error?.name).toBe('AbortError')
  })
})
