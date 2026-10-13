import { fireEvent, render, screen } from '@testing-library/react'

import { UploadDrawer } from '../UploadDrawer'
import {
  mockSortedTransactions,
  mockUploadSteps,
} from '../../shared/__mocks__/upload.mock'

describe('UploadDrawer', () => {
  const onCancel = vi.fn()
  const onOpenChange = vi.fn()

  beforeEach(() => {
    render(
      <UploadDrawer
        open
        onOpenChange={onOpenChange}
        fileName="capitec_oct_2026.csv"
        fileRange="1 to 12 Oct 2026"
        steps={mockUploadSteps}
        sorted={mockSortedTransactions}
        onCancel={onCancel}
      />,
    )
  })

  it('renders the drawer title and file', () => {
    expect(screen.getByText('Importing statement')).toBeInTheDocument()
    expect(screen.getByText('capitec_oct_2026.csv')).toBeInTheDocument()
    expect(screen.getByText('1 to 12 Oct 2026')).toBeInTheDocument()
  })

  it('renders each import step and its progress', () => {
    expect(screen.getByText('Read file')).toBeInTheDocument()
    expect(screen.getByText('48 transactions found')).toBeInTheDocument()
    expect(screen.getByText('Sorting into categories')).toBeInTheDocument()
    expect(screen.getByText('41 of 48')).toBeInTheDocument()
    expect(screen.getByText('Ready to review')).toBeInTheDocument()
  })

  it('renders the sorted transactions so far', () => {
    expect(screen.getByText('Sorted so far')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Easy Equities TFSA')).toBeInTheDocument()
  })

  it('calls onCancel when cancelling the import', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
