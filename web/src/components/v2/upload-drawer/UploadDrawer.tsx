import { useRef } from 'react'

import { Button } from '@/components/v2/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

import * as UploadDrawerCompound from './UploadDrawer.compound'
import type { UploadDrawerProps } from './UploadDrawer.types'

export function UploadDrawer({
  open,
  onOpenChange,
  status = 'importing',
  fileName,
  fileRange,
  csvText,
  onCsvTextChange,
  onPasteSubmit,
  onFile,
  steps,
  sorted,
  summary,
  onCancel,
  onDone,
}: UploadDrawerProps) {
  const isMobile = useIsMobile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isIdle = status === 'idle'
  const isSuccess = status === 'success'
  const canSubmit = Boolean(csvText?.trim())

  return (
    <UploadDrawerCompound.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? 'bottom' : 'right'}
    >
      <UploadDrawerCompound.Content>
        <UploadDrawerCompound.Header>
          <UploadDrawerCompound.Title>
            {isSuccess
              ? 'Import complete'
              : isIdle
                ? 'Import statement'
                : 'Importing statement'}
          </UploadDrawerCompound.Title>
          <UploadDrawerCompound.Close />
        </UploadDrawerCompound.Header>
        <UploadDrawerCompound.Description>
          {isSuccess
            ? 'Your statement has been imported'
            : isIdle
              ? 'Pick a CSV file or paste one to import'
              : `Import progress for ${fileName}`}
        </UploadDrawerCompound.Description>
        <UploadDrawerCompound.Body>
          {isIdle ? (
            <UploadDrawerCompound.Start
              value={csvText ?? ''}
              onChange={onCsvTextChange}
              onSubmit={onPasteSubmit}
              onPickFile={() => fileInputRef.current?.click()}
            />
          ) : isSuccess ? (
            <UploadDrawerCompound.Success summary={summary} />
          ) : (
            <>
              <UploadDrawerCompound.File
                fileName={fileName}
                fileRange={fileRange}
              />
              <UploadDrawerCompound.StepList>
                {steps.map((step) => (
                  <UploadDrawerCompound.Step
                    key={step.id}
                    status={step.status}
                    title={step.title}
                    description={step.description}
                    count={step.count}
                    progress={step.progress}
                  />
                ))}
              </UploadDrawerCompound.StepList>
              {sorted.length > 0 && (
                <UploadDrawerCompound.Sorted>
                  {sorted.map((item) => (
                    <UploadDrawerCompound.SortedRow
                      key={item.id}
                      emoji={item.emoji}
                      name={item.name}
                      category={item.category}
                    />
                  ))}
                </UploadDrawerCompound.Sorted>
              )}
            </>
          )}
        </UploadDrawerCompound.Body>
        <UploadDrawerCompound.Footer>
          {isIdle ? (
            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={onPasteSubmit}
            >
              Import pasted CSV
            </Button>
          ) : isSuccess ? (
            <Button variant="outline" className="w-full" onClick={onDone}>
              Done
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancel import
            </Button>
          )}
        </UploadDrawerCompound.Footer>
      </UploadDrawerCompound.Content>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Statement CSV file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Let the same file be picked again after a restart of the import.
          event.target.value = ''
          if (file) onFile?.(file)
        }}
      />
    </UploadDrawerCompound.Root>
  )
}
