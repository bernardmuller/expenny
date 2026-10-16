import * as MobileNavCompound from './MobileNav.compound'
import type { MobileNavProps } from './MobileNav.types'

export function MobileNav({
  userName,
  items,
  activeId,
  onNavigate,
  onUpload,
  onPaste,
}: MobileNavProps) {
  return (
    <>
      <MobileNavCompound.Header userName={userName} />
      <MobileNavCompound.Bar
        items={items}
        activeId={activeId}
        onNavigate={onNavigate}
        onUpload={onUpload}
        onPaste={onPaste}
      />
    </>
  )
}
