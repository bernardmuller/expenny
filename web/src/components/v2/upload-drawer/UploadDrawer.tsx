import { Button } from '@/components/v2/ui/button'

import * as UploadDrawerCompound from './UploadDrawer.compound'
import type { UploadDrawerProps } from './UploadDrawer.types'

export function UploadDrawer({
  open,
  onOpenChange,
  fileName,
  fileRange,
  steps,
  sorted,
  onCancel,
}: UploadDrawerProps) {
  return (
    <UploadDrawerCompound.Root open={open} onOpenChange={onOpenChange}>
      <UploadDrawerCompound.Content>
        <UploadDrawerCompound.Header>
          <UploadDrawerCompound.Title>
            Importing statement
          </UploadDrawerCompound.Title>
          <UploadDrawerCompound.Close />
        </UploadDrawerCompound.Header>
        <UploadDrawerCompound.Description>
          Import progress for {fileName}
        </UploadDrawerCompound.Description>
        <UploadDrawerCompound.Body>
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
        </UploadDrawerCompound.Body>
        <UploadDrawerCompound.Footer>
          <Button variant="outline" className="w-full" onClick={onCancel}>
            Cancel import
          </Button>
        </UploadDrawerCompound.Footer>
      </UploadDrawerCompound.Content>
    </UploadDrawerCompound.Root>
  )
}
