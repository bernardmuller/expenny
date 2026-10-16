import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { UploadDrawer } from '../UploadDrawer'
import {
  mockSortedTransactions,
  mockUploadSteps,
  mockUploadSummary,
} from '../../shared/__mocks__/upload.mock'
import type { UploadDrawerProps } from '../UploadDrawer.types'

const onCancel = vi.fn()
const onOpenChange = vi.fn()
const onDone = vi.fn()
const onPasteSubmit = vi.fn()
const onCsvTextChange = vi.fn()
const onFile = vi.fn()

function renderDrawer(props: Partial<UploadDrawerProps> = {}) {
  return render(
    <UploadDrawer
      open
      onOpenChange={onOpenChange}
      fileName="capitec_oct_2026.csv"
      fileRange="1 to 12 Oct 2026"
      steps={mockUploadSteps}
      sorted={mockSortedTransactions}
      onCancel={onCancel}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UploadDrawer', () => {
  it('renders the drawer title and file', () => {
    renderDrawer()

    expect(screen.getByText('Importing statement')).toBeInTheDocument()
    expect(screen.getByText('capitec_oct_2026.csv')).toBeInTheDocument()
    expect(screen.getByText('1 to 12 Oct 2026')).toBeInTheDocument()
  })

  it('renders each import step and its live progress', () => {
    renderDrawer()

    expect(screen.getByText('Read statement')).toBeInTheDocument()
    expect(screen.getByText('48 transactions found')).toBeInTheDocument()
    expect(screen.getByText('Sorting into categories')).toBeInTheDocument()
    expect(screen.getByText('41 of 48')).toBeInTheDocument()
    expect(screen.getByText('Ready to review')).toBeInTheDocument()
  })

  it('renders the sorted transactions so far', () => {
    renderDrawer()

    expect(screen.getByText('Sorted so far')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Easy Equities TFSA')).toBeInTheDocument()
  })

  it('calls onCancel when cancelling the import', () => {
    renderDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows the success summary and closes via Done', () => {
    renderDrawer({ status: 'success', summary: mockUploadSummary, onDone })

    expect(screen.getByText('Import complete')).toBeInTheDocument()
    expect(screen.getByText('All transactions imported')).toBeInTheDocument()
    expect(screen.getByText('48 transactions processed')).toBeInTheDocument()
    expect(screen.getByText('Categorised')).toBeInTheDocument()
    expect(screen.getByText('To review')).toBeInTheDocument()
    expect(screen.queryByText('Cancel import')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('submits pasted CSV once there is content', () => {
    function Harness() {
      const [csv, setCsv] = useState('')

      return (
        <UploadDrawer
          open
          status="idle"
          fileName=""
          fileRange=""
          csvText={csv}
          onCsvTextChange={setCsv}
          onPasteSubmit={onPasteSubmit}
          steps={mockUploadSteps}
          sorted={[]}
        />
      )
    }

    render(<Harness />)

    const submit = screen.getByRole('button', { name: 'Import pasted CSV' })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox', { name: 'Statement CSV' }), {
      target: { value: 'Date,Description,Amount\n2026-10-01,Checkers,-452.90' },
    })

    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    expect(onPasteSubmit).toHaveBeenCalled()
  })

  it('offers a file picker in the idle state', () => {
    renderDrawer({ status: 'idle', onFile })

    const file = new File(['Date,Description,Amount'], 'statement.csv', {
      type: 'text/csv',
    })
    fireEvent.change(screen.getByLabelText('Statement CSV file'), {
      target: { files: [file] },
    })

    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('reports paste edits through onCsvTextChange', () => {
    renderDrawer({
      status: 'idle',
      csvText: '',
      onCsvTextChange,
      onPasteSubmit,
    })

    fireEvent.change(screen.getByRole('textbox', { name: 'Statement CSV' }), {
      target: { value: 'a,b,c' },
    })

    expect(onCsvTextChange).toHaveBeenCalledWith('a,b,c')
  })
})
