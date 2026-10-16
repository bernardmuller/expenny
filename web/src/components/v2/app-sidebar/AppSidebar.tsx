import type { AppSidebarProps } from './AppSidebar.types'
import * as AppSidebarCompound from './AppSidebar.compound'

export function AppSidebar({
  items,
  activeId,
  userName,
  defaultOpen,
  onNavigate,
  onUpload,
  onPaste,
}: AppSidebarProps) {
  return (
    <AppSidebarCompound.Provider defaultOpen={defaultOpen}>
      <AppSidebarCompound.Root>
        <AppSidebarCompound.Header>
          <AppSidebarCompound.Logo name="Expenny" />
          {onUpload && <AppSidebarCompound.UploadAction onClick={onUpload} />}
          {onPaste && <AppSidebarCompound.PasteAction onClick={onPaste} />}
        </AppSidebarCompound.Header>
        <AppSidebarCompound.Content>
          <AppSidebarCompound.Nav>
            {items.map((item) => {
              const Icon = item.icon
              const isActive = item.id === activeId
              const contents = (
                <>
                  <AppSidebarCompound.NavIcon
                    accent={item.accent}
                    active={isActive}
                  >
                    <Icon />
                  </AppSidebarCompound.NavIcon>
                  <span
                    className="truncate group-data-[collapsible=icon]:hidden"
                  >
                    {item.label}
                  </span>
                  {item.badge != null && (
                    <AppSidebarCompound.NavBadge>
                      {item.badge}
                    </AppSidebarCompound.NavBadge>
                  )}
                </>
              )

              if (item.linkProvider) {
                const LinkProvider = item.linkProvider
                return (
                  <AppSidebarCompound.NavItem key={item.id}>
                    <AppSidebarCompound.NavButton asChild isActive={isActive}>
                      <LinkProvider>{contents}</LinkProvider>
                    </AppSidebarCompound.NavButton>
                  </AppSidebarCompound.NavItem>
                )
              }

              return (
                <AppSidebarCompound.NavItem key={item.id}>
                  <AppSidebarCompound.NavButton
                    isActive={isActive}
                    onClick={() => onNavigate?.(item.id)}
                  >
                    {contents}
                  </AppSidebarCompound.NavButton>
                </AppSidebarCompound.NavItem>
              )
            })}
          </AppSidebarCompound.Nav>
        </AppSidebarCompound.Content>
        <AppSidebarCompound.Footer>
          <AppSidebarCompound.User name={userName} />
        </AppSidebarCompound.Footer>
        <AppSidebarCompound.Rail />
      </AppSidebarCompound.Root>
    </AppSidebarCompound.Provider>
  )
}
