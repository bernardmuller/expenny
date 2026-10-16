import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { queryKeys } from '@/lib/http/query-keys'
import { CorrectionsAdmin } from '../CorrectionsAdmin'

const { fetchMock } = vi.hoisted(() => {
  import.meta.env.VITE_API_URL = 'http://api.test'
  const mock = vi.fn()
  globalThis.fetch = mock as unknown as typeof fetch
  return { fetchMock: mock }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const groceries = {
  id: 'groceries',
  key: 'groceries',
  label: 'Groceries',
  icon: '🛒',
  groups: [],
}

const fuel = { id: 'fuel', key: 'fuel', label: 'Fuel', icon: '⛽', groups: [] }

const seededCorrections = {
  corrections: [
    {
      id: 'correction-1',
      description: 'checkers claremont',
      category: groceries,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
  ],
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Reads succeed so the suspending query has data; writes hang so the
 * optimistic state can be asserted before the server answers. */
function mockReadsOnly() {
  fetchMock.mockImplementation((_url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    if (method === 'GET')
      return Promise.resolve(jsonResponse(seededCorrections))
    return new Promise<Response>(() => {})
  })
}

function renderAdmin(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CorrectionsAdmin />
    </QueryClientProvider>,
  )
}

describe('CorrectionsAdmin', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })
    queryClient.setQueryData(queryKeys.corrections, seededCorrections)
    queryClient.setQueryData(queryKeys.statements.categories, {
      categories: [groceries, fuel],
    })

    fetchMock.mockReset()
    mockReadsOnly()
  })

  it('lists the corrections with their category', () => {
    renderAdmin(queryClient)

    expect(screen.getByText('checkers claremont')).toBeInTheDocument()
    expect(
      screen.getByText('Groceries', {
        selector: '[data-slot="category-pill"]',
      }),
    ).toBeInTheDocument()
  })

  it('creates a correction and shows it optimistically', async () => {
    const user = userEvent.setup()
    renderAdmin(queryClient)

    await user.click(screen.getByRole('button', { name: 'New' }))
    await user.type(
      screen.getByPlaceholderText('Checkers Claremont'),
      'Woolworths Kenilworth',
    )
    await user.click(screen.getByPlaceholderText('Select category'))
    await user.click(await screen.findByText('⛽ Fuel'))
    await user.click(screen.getByRole('button', { name: 'Create correction' }))

    expect(await screen.findByText('Woolworths Kenilworth')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v2/corrections',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          description: 'Woolworths Kenilworth',
          category_id: 'fuel',
        }),
      }),
    )
  })

  it('edits a correction and shows the change optimistically', async () => {
    const user = userEvent.setup()
    renderAdmin(queryClient)

    await user.click(
      screen.getByRole('button', { name: 'Edit checkers claremont' }),
    )
    const description = screen.getByDisplayValue('checkers claremont')
    await user.clear(description)
    await user.type(description, 'Checkers Hyper')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Checkers Hyper')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v2/corrections/correction-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          description: 'Checkers Hyper',
          category_id: 'groceries',
        }),
      }),
    )
  })

  it('deletes a correction after confirming', async () => {
    const user = userEvent.setup()
    renderAdmin(queryClient)

    await user.click(
      screen.getByRole('button', { name: 'Delete checkers claremont' }),
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.queryByText('checkers claremont')).not.toBeInTheDocument(),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v2/corrections/correction-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
