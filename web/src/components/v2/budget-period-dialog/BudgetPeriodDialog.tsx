import { endOfMonth, format, startOfMonth } from 'date-fns'
import { useEffect, useState } from 'react'

import { Button } from '@/components/v2/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/v2/ui/dialog'
import { Input } from '@/components/v2/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/v2/ui/select'
import { Spinner } from '@/components/v2/ui/spinner'

import type { BudgetPeriodDialogProps } from './BudgetPeriodDialog.types'

const ALL_ACCOUNTS = 'all'

const fieldLabel =
  'text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase'

/**
 * Edits the window the dashboard budget is derived from. Defaults to the
 * current month when no preference has been saved yet.
 */
export function BudgetPeriodDialog({
  open,
  onOpenChange,
  preferences,
  accounts,
  isSaving,
  onSubmit,
}: BudgetPeriodDialogProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [account, setAccount] = useState(ALL_ACCOUNTS)

  useEffect(() => {
    if (!open) return
    const today = new Date()
    setStartDate(
      preferences?.start_date ?? format(startOfMonth(today), 'yyyy-MM-dd'),
    )
    setEndDate(preferences?.end_date ?? format(endOfMonth(today), 'yyyy-MM-dd'))
    setAccount(preferences?.account ?? ALL_ACCOUNTS)
  }, [open, preferences])

  const invalidWindow = Boolean(startDate && endDate && endDate < startDate)

  const submit = () => {
    if (!startDate || !endDate || invalidWindow) return
    onSubmit({
      startDate,
      endDate,
      account: account === ALL_ACCOUNTS ? null : account,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Budget period</DialogTitle>
          <DialogDescription>
            The salary credited between these dates becomes your budget total.
            What&apos;s left is the latest balance on your statement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className={fieldLabel}>Start date</span>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className={fieldLabel}>End date</span>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>

          {invalidWindow && (
            <p className="text-destructive text-sm">
              The end date has to be on or after the start date.
            </p>
          )}

          <label className="block space-y-1.5">
            <span className={fieldLabel}>Account</span>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ACCOUNTS}>All accounts</SelectItem>
                {accounts.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!startDate || !endDate || invalidWindow || isSaving}
            onClick={submit}
          >
            {isSaving && <Spinner className="size-4" />}
            Save period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
